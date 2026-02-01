// Correcao_testes/WISC_IV/script.js

const LAUDOS_KEY = "empresa_laudos_wisciv_v1";

let NORMAS = null;
async function carregarNormas(){
  if (NORMAS) return NORMAS;

  const url = "data/normas-wisciv.json";
  const resp = await fetch(url, { cache: "no-store" });

  if (!resp.ok) {
    throw new Error(`Falha ao carregar : ${url} (HTTP ${resp.status})`);
  }

  const json = await resp.json();

  // checagem mínima para evitar "carregou mas veio vazio"
  if (!json || typeof json !== "object" || Object.keys(json).length === 0) {
    throw new Error("Normas carregadas, mas o JSON veio vazio ou inválido.");
  }

  NORMAS = json;
  return NORMAS;
}


// Subtestes (ordem objetiva)
const SUBTESTES = [
  { nome: "Cubos", codigo: "CB", id:"pb_CB" },
  { nome: "Semelhanças", codigo: "SM", id:"pb_SM" },
  { nome: "Dígitos", codigo: "DG", id:"pb_DG" },
  { nome: "Conceitos Figurativos", codigo: "CN", id:"pb_CN" },
  { nome: "Código", codigo: "CD", id:"pb_CD" },
  { nome: "Vocabulário", codigo: "VC", id:"pb_VC" },
  { nome: "Seq. de Números e Letras", codigo: "SNL", id:"pb_SNL" },
  { nome: "Raciocínio Matricial", codigo: "RM", id:"pb_RM" },
  { nome: "Compreensão", codigo: "CO", id:"pb_CO" },
  { nome: "Procurar Símbolos", codigo: "PS", id:"pb_PS" },
  // suplementares
  { nome: "Completar Figuras", codigo: "CF", id:"pb_CF" },
  { nome: "Cancelamento", codigo: "CA", id:"pb_CA" },
  { nome: "Informação", codigo: "IN", id:"pb_IN" },
  { nome: "Aritmética", codigo: "AR", id:"pb_AR" },
  { nome: "Raciocínio com Palavras", codigo: "RP", id:"pb_RP" },
];

const INDICES = {
  ICV: { nome: "ICV", core: ["SM","VC","CO"], supl: ["IN","RP"], n: 3 },
  IOP: { nome: "IOP", core: ["CB","CN","RM"], supl: ["CF"], n: 3 },
  IMO: { nome: "IMO", core: ["DG","SNL"], supl: ["AR"], n: 2 },
  IVP: { nome: "IVP", core: ["CD","PS"], supl: ["CA"], n: 2 },
};

const QI_CORE = ["SM","VC","CO","CB","CN","RM","DG","SNL","CD","PS"];

function calcularIdade(nascISO, aplISO) {
  if (!nascISO || !aplISO) return null;
  const n = new Date(nascISO);
  const a = new Date(aplISO);
  if (isNaN(n.getTime()) || isNaN(a.getTime()) || a < n) return null;

  let anos = a.getFullYear() - n.getFullYear();
  let meses = a.getMonth() - n.getMonth();
  if (a.getDate() < n.getDate()) meses -= 1;
  if (meses < 0) { anos -= 1; meses += 12; }
  return { anos, meses, totalMeses: anos * 12 + meses };
}

/**
 * Converte string de faixa em {minMeses, maxMeses} aceitando:
 *  - "6:0-6:3"  (anos:meses - anos:meses)
 *  - "6:0-0:6"  (caso seu JSON tenha invertido, interpretamos como 6:0-6:0??)
 *  - "72-83"    (caso existam faixas só em meses)
 */
function parseFaixa(faixaStr){
  if(!faixaStr || typeof faixaStr !== "string") return null;

  // tenta "A:M-B:M" ou "A:M-0:M" etc
  if(faixaStr.includes("-") && faixaStr.includes(":")){
    const [ini, fim] = faixaStr.split("-");
    if(!ini || !fim) return null;

    const [aiRaw, miRaw] = ini.split(":");
    const [afRaw, mfRaw] = fim.split(":");
    const ai = Number(aiRaw), mi = Number(miRaw);
    const af = Number(afRaw), mf = Number(mfRaw);
    if([ai,mi,af,mf].some(x => Number.isNaN(x))) return null;

    // Caso raro: fim vem como "0:6" por erro de formatação.
    // Se af === 0 e ai > 0, interpretamos como "ai:mi - ai:mf"
    // (mantém dentro do mesmo ano)
    let min = ai * 12 + mi;
    let max = af * 12 + mf;
    if(af === 0 && ai > 0){
      max = ai * 12 + mf;
    }

    // garante min<=max
    if(max < min) [min, max] = [max, min];
    return { minMeses: min, maxMeses: max };
  }

  // tenta "72-83" (meses)
  if(/^\d+\s*-\s*\d+$/.test(faixaStr)){
    const [a,b] = faixaStr.split("-").map(x => Number(String(x).trim()));
    if([a,b].some(Number.isNaN)) return null;
    const minMeses = Math.min(a,b);
    const maxMeses = Math.max(a,b);
    return { minMeses, maxMeses };
  }

  return null;
}

function faixaEtaria(normas, idade) {
  if (!idade) return null;
  const total = idade.totalMeses;

  const keys = Object.keys(normas || {});
  // ordena por minMeses para não depender da ordem do JSON
  const parsed = keys
    .map(k => ({ k, p: parseFaixa(k) }))
    .filter(x => x.p && Number.isFinite(x.p.minMeses) && Number.isFinite(x.p.maxMeses))
    .sort((a,b) => a.p.minMeses - b.p.minMeses);

  for(const item of parsed){
    const { k, p } = item;
    if(total >= p.minMeses && total <= p.maxMeses) return k;
  }
  return null;
}

function brutoParaPonderado(normas, faixa, codigo, bruto) {
  const regras = normas?.[faixa]?.subtestes?.[codigo];
  if (!Array.isArray(regras)) return null;
  const r = regras.find(x => bruto >= x.min && bruto <= x.max);
  return r ? Number(r.ponderado) : null;
}

function classificarPonderado(p) {
  if (p <= 4) return "Muito Inferior";
  if (p <= 6) return "Inferior";
  if (p <= 8) return "Médio Inferior";
  if (p <= 11) return "Médio";
  if (p <= 13) return "Médio Superior";
  if (p <= 15) return "Superior";
  return "Muito Superior";
}

function somarIndice(pondByCode, def) {
  let usados = def.core.filter(c => pondByCode[c] != null);
  if (usados.length < def.n && def.supl?.length) {
    for (const s of def.supl) {
      if (pondByCode[s] != null) { usados.push(s); break; }
    }
  }
  if (usados.length !== def.n) return { soma: null, usados };
  const soma = usados.reduce((acc, c) => acc + Number(pondByCode[c]), 0);
  return { soma, usados };
}

function somarQI(pondByCode) {
  const usados = QI_CORE.filter(c => pondByCode[c] != null);
  if (usados.length !== 10) return { soma: null, usados };
  const soma = usados.reduce((a,c)=>a+Number(pondByCode[c]),0);
  return { soma, usados };
}

function obterNomeSubteste(codigo){
  const map = {
    CB:"Cubos", SM:"Semelhanças", DG:"Dígitos", CN:"Conceitos Figurativos", CD:"Código",
    VC:"Vocabulário", SNL:"Seq. Núm. e Letras", RM:"Raciocínio Matricial", CO:"Compreensão",
    PS:"Procurar Símbolos", CF:"Completar Figuras", CA:"Cancelamento", IN:"Informação",
    AR:"Aritmética", RP:"Raciocínio com Palavras"
  };
  return map[codigo] || codigo;
}

function cellIndice(codigo, setUsado, setPossivel, resultados) {
  if (!setPossivel.has(codigo)) return `<td class="idx"></td>`;
  if (!setUsado.has(codigo)) return `<td class="idx fill empty"></td>`;
  const r = resultados[codigo];
  if (!r) return `<td class="idx fill"></td>`;
  const suplementar = ["CF","CA","IN","AR","RP"].includes(codigo);
  const cls = suplementar ? "pill sup" : "pill";
  return `<td class="idx fill"><span class="${cls}">${r.ponderado}</span></td>`;
}

function renderMatrizConversao({ resultados, indicesInfo, qiInfo }) {
  const usadosICV = new Set(indicesInfo?.ICV?.usados || []);
  const usadosIOP = new Set(indicesInfo?.IOP?.usados || []);
  const usadosIMO = new Set(indicesInfo?.IMO?.usados || []);
  const usadosIVP = new Set(indicesInfo?.IVP?.usados || []);
  const usadosQI  = new Set(qiInfo?.usados || []);

  const possiveis = {
    ICV: new Set(["SM","VC","CO","IN","RP"]),
    IOP: new Set(["CB","CN","RM","CF"]),
    IMO: new Set(["DG","SNL","AR"]),
    IVP: new Set(["CD","PS","CA"]),
  };

  const ordem = ["CB","SM","DG","CN","CD","VC","SNL","RM","CO","PS","CF","CA","IN","AR","RP"];

  const linhas = ordem.map(codigo => {
    const r = resultados[codigo] || { bruto: "", ponderado: "" };
    const nome = obterNomeSubteste(codigo);

    const qitCell =
      usadosQI.has(codigo) && resultados[codigo]
        ? `<td class="idx fill"><span class="pill">${resultados[codigo].ponderado}</span></td>`
        : usadosQI.has(codigo)
          ? `<td class="idx fill empty"></td>`
          : `<td class="idx"></td>`;

    return `
      <tr>
        <td class="col-sub"><b>${nome}</b> <span class="muted">(${codigo})</span></td>
        <td class="col-pb">${r.bruto ?? ""}</td>
        <td class="col-pp">${r.ponderado ?? ""}</td>
        ${cellIndice(codigo, usadosICV, possiveis.ICV, resultados)}
        ${cellIndice(codigo, usadosIOP, possiveis.IOP, resultados)}
        ${cellIndice(codigo, usadosIMO, possiveis.IMO, resultados)}
        ${cellIndice(codigo, usadosIVP, possiveis.IVP, resultados)}
        ${qitCell}
      </tr>
    `;
  }).join("");

  return `
    <table class="wisc-matrix">
      <thead>
        <tr>
          <th class="col-sub">Subtestes</th>
          <th class="col-pb">PB</th>
          <th class="col-pp">Ponderado</th>
          <th colspan="5">Contribuição (Pontos Ponderados)</th>
        </tr>
        <tr>
          <th></th><th></th><th></th>
          <th class="idx">ICV</th>
          <th class="idx">IOP</th>
          <th class="idx">IMO</th>
          <th class="idx">IVP</th>
          <th class="idx">QIT</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
      <tfoot>
        <tr>
          <td class="sum-label" colspan="3">Soma dos Pontos Ponderados</td>
          <td>${indicesInfo?.ICV?.soma ?? "—"}</td>
          <td>${indicesInfo?.IOP?.soma ?? "—"}</td>
          <td>${indicesInfo?.IMO?.soma ?? "—"}</td>
          <td>${indicesInfo?.IVP?.soma ?? "—"}</td>
          <td>${qiInfo?.soma ?? "—"}</td>
        </tr>
      </tfoot>
    </table>
  `;
}

function montarInputsSubtestes(){
  const tbody = document.getElementById("tbodySubtestes");
  if(!tbody) return;
  tbody.innerHTML = "";
  SUBTESTES.forEach(s=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${s.nome}</b> <span class="muted">(${s.codigo})</span></td>
      <td><input type="number" min="0" id="${s.id}" placeholder="Bruto"></td>
    `;
    tbody.appendChild(tr);
  });
}

function atualizarPreviewIdade(){
  const nasc = document.getElementById("dataNascimento")?.value;
  const apl  = document.getElementById("dataAplicacao")?.value;
  const idadeEl = document.getElementById("idadeCalculada");
  const faixaEl = document.getElementById("faixaCalculada");
  if(!idadeEl || !faixaEl) return;

  if(!nasc || !apl){ idadeEl.textContent=""; faixaEl.textContent=""; return; }
  const idade = calcularIdade(nasc, apl);
  if(!idade){ idadeEl.textContent="Datas inválidas."; faixaEl.textContent=""; return; }

  idadeEl.textContent = `Idade na aplicação: ${idade.anos} anos e ${idade.meses} meses.`;
  carregarNormas().then(normas=>{
    const faixa = faixaEtaria(normas, idade);
    faixaEl.textContent = faixa ? `Faixa normativa: ${faixa}` : "Faixa normativa: não encontrada.";
  }).catch(()=>{});
}

function getLaudos(){
  return JSON.parse(localStorage.getItem(LAUDOS_KEY) || "[]");
}
function setLaudos(arr){
  localStorage.setItem(LAUDOS_KEY, JSON.stringify(arr));
}

async function calcular(salvar){
  try{
    const normas = await carregarNormas();
    const nome = (document.getElementById("nome")?.value || "").trim();
    const nasc = document.getElementById("dataNascimento")?.value;
    const apl  = document.getElementById("dataAplicacao")?.value;

    if(!nome || !nasc || !apl){ alert("Preencha Nome, Nascimento e Aplicação."); return; }

    const idade = calcularIdade(nasc, apl);
    if(!idade){ alert("Datas inválidas."); return; }

    const faixa = faixaEtaria(normas, idade);
    if(!faixa){ alert("Faixa normativa não encontrada."); return; }

    const resultados = {};
    const pondByCode = {};

    for(const s of SUBTESTES){
      const v = document.getElementById(s.id)?.value;
      if(v === "" || v == null) continue;
      const bruto = Number(v);
      if(Number.isNaN(bruto) || bruto < 0){ alert(`Valor inválido em ${s.nome}`); return; }

      const pond = brutoParaPonderado(normas, faixa, s.codigo, bruto);
      if(pond == null){ alert(`PB fora da norma em ${s.nome} (${s.codigo}) para faixa ${faixa}`); return; }

      resultados[s.codigo] = {
        nome: s.nome,
        codigo: s.codigo,
        bruto,
        ponderado: pond,
        classificacao: classificarPonderado(pond)
      };
      pondByCode[s.codigo] = pond;
    }

    if(Object.keys(pondByCode).length === 0){ alert("Preencha ao menos um subteste."); return; }

    const indicesInfo = {
      ICV: somarIndice(pondByCode, INDICES.ICV),
      IOP: somarIndice(pondByCode, INDICES.IOP),
      IMO: somarIndice(pondByCode, INDICES.IMO),
      IVP: somarIndice(pondByCode, INDICES.IVP),
    };

    const qiInfo = somarQI(pondByCode);

    montarRelatorio({ nome, nasc, apl, idade, faixa, resultados, indicesInfo, qiInfo });

    if(salvar){
      const rel = document.getElementById("relatorio");
      await html2pdf().set({
        margin: 10,
        filename: `WISC-IV_${nome}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { format: "a4" }
      }).from(rel).save();

      const laudos = getLaudos();
      laudos.unshift({
        nome,
        dataAplicacao: apl,
        faixa,
        createdAt: new Date().toISOString(),
        htmlRelatorio: rel.outerHTML
      });
      setLaudos(laudos);

      alert("Laudo salvo e PDF gerado.");
    }

  }catch(e){
    console.error(e);
    alert("Erro ao calcular. Consulte o suporte!");
  }
}

let chartSub = null;
let chartIdx = null;

function montarRelatorio(data){
  const rel = document.getElementById("relatorio");
  if(!rel) return;

  const { nome, nasc, apl, idade, faixa, resultados, indicesInfo, qiInfo } = data;
  const matriz = renderMatrizConversao({ resultados, indicesInfo, qiInfo });

  rel.style.display = "block";
  rel.innerHTML = `
    <div class="topline">
      <div style="display:flex;align-items:center;gap:12px;">
        <!-- IMPORTANTE: sem caminho absoluto. Usamos a logo do sistema -->
        <img class="logo" src="logo2.png" alt="Logo" onerror="this.style.display='none'">
        <div>
          <div style="font-weight:800;color:#0d47a1;font-size:16px;">Relatório – WISC-IV</div>
          <div class="muted">Gerado automaticamente</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div class="badge">Faixa: ${faixa}</div>
        <div class="muted" style="margin-top:6px;">Idade: ${idade.anos}a ${idade.meses}m</div>
      </div>
    </div>

    <div class="section">
      <div><b style="color:#0d47a1">Nome:</b> ${nome}</div>
      <div class="muted" style="margin-top:6px;">
        <b style="color:#0d47a1">Nascimento:</b> ${nasc} &nbsp;&nbsp;|&nbsp;&nbsp;
        <b style="color:#0d47a1">Aplicação:</b> ${apl}
      </div>
    </div>

    <div class="section">
      <h3>Conversão PB → Ponderado e contribuição nos Índices</h3>
      <div class="matrix-card">${matriz}</div>
      <p class="muted" style="margin:10px 0 0;">
        Células azuis indicam subtestes que compõem a soma do índice/QIT (suplementares podem aparecer entre parênteses).
      </p>
    </div>

    <div class="section">
      <h3>Subtestes</h3>
      <div class="canvas-wrap"><canvas id="grafSub" height="160"></canvas></div>
      <table class="table" style="margin-top:12px;">
        <thead><tr><th>Subteste</th><th>PB</th><th>Ponderado</th><th>Classificação</th></tr></thead>
        <tbody>
          ${Object.values(resultados).map(r=>`
            <tr>
              <td><b>${r.nome}</b> <span class="muted">(${r.codigo})</span></td>
              <td>${r.bruto}</td>
              <td>${r.ponderado}</td>
              <td>${r.classificacao}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h3>Índices e QIT (somatórios)</h3>
      <div class="canvas-wrap"><canvas id="grafIdx" height="160"></canvas></div>

      <table class="table" style="margin-top:12px;">
        <thead><tr><th>Medida</th><th>Soma (ponderados)</th><th>Subtestes usados</th></tr></thead>
        <tbody>
          ${Object.entries(INDICES).map(([k])=>{
            const info = indicesInfo[k];
            return `
              <tr>
                <td><b>${k}</b></td>
                <td>${info.soma ?? "—"}</td>
                <td>${(info.usados||[]).join(", ") || "—"}</td>
              </tr>
            `;
          }).join("")}
          <tr>
            <td><b>QIT</b></td>
            <td>${qiInfo.soma ?? "—"}</td>
            <td>${(qiInfo.usados||[]).join(", ") || "—"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  desenharGraficos(resultados, indicesInfo, qiInfo);
}

function desenharGraficos(resultados, indicesInfo, qiInfo){
  const ctxSub = document.getElementById("grafSub");
  if(ctxSub){
    if(chartSub) chartSub.destroy();
    const labels = Object.values(resultados).map(r=>r.codigo);
    const vals   = Object.values(resultados).map(r=>r.ponderado);
    chartSub = new Chart(ctxSub, {
      type:"line",
      data:{ labels, datasets:[{ data: vals, showLine:false, pointRadius:4, pointHoverRadius:5, borderWidth:0 }] },
      options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ min:1, max:19, ticks:{ stepSize:1 } } } }
    });
  }

  const ctxIdx = document.getElementById("grafIdx");
  if(ctxIdx){
    if(chartIdx) chartIdx.destroy();
    const labels = ["ICV","IOP","IMO","IVP","QIT"];
    const vals = [
      indicesInfo.ICV?.soma ?? null,
      indicesInfo.IOP?.soma ?? null,
      indicesInfo.IMO?.soma ?? null,
      indicesInfo.IVP?.soma ?? null,
      qiInfo?.soma ?? null,
    ];
    chartIdx = new Chart(ctxIdx, {
      type:"line",
      data:{ labels, datasets:[{ data: vals, showLine:false, pointRadius:4, pointHoverRadius:5, borderWidth:0 }] },
      options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } }
    });
  }
}

function renderListaLaudos(){
  const box = document.getElementById("listaLaudos");
  if(!box) return;

  const laudos = getLaudos();
  if(!laudos.length){
    box.innerHTML = `<p class="muted">Nenhum laudo salvo ainda.</p>`;
    return;
  }

  box.innerHTML = `
    <table class="table">
      <thead><tr><th>Paciente</th><th>Aplicação</th><th>Faixa</th><th>Ações</th></tr></thead>
      <tbody>
        ${laudos.map((x, idx)=>`
          <tr>
            <td>${x.nome}</td>
            <td>${x.dataAplicacao}</td>
            <td><span class="badge">${x.faixa}</span></td>
            <td><button class="btn-outline" onclick="baixarPDFSalvo(${idx})">Baixar PDF</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function baixarPDFSalvo(index){
  const laudos = getLaudos();
  const item = laudos[index];
  if(!item) return alert("Laudo não encontrado.");

  const temp = document.createElement("div");
  temp.innerHTML = item.htmlRelatorio;
  document.body.appendChild(temp);

  html2pdf().set({
    margin: 10,
    filename: `WISC-IV_${item.nome}.pdf`,
    html2canvas: { scale: 2 },
    jsPDF: { format: "a4" }
  }).from(temp).save().then(()=>temp.remove());
}

(function init(){
  // novo-laudo
  if(document.getElementById("tbodySubtestes")){
    montarInputsSubtestes();
    document.getElementById("dataNascimento")?.addEventListener("change", atualizarPreviewIdade);
    document.getElementById("dataAplicacao")?.addEventListener("change", atualizarPreviewIdade);
  }

  // laudos
  if(document.getElementById("listaLaudos")){
    renderListaLaudos();
  }
})();
