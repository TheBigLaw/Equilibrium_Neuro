// tests/wisciv/script.js

const LAUDOS_KEY = "empresa_laudos_wisciv_v1";

let NORMAS = null;
async function carregarNormas(){
  if(NORMAS) return NORMAS;
  const resp = await fetch("data/normas-wisciv.json", { cache:"no-store" });
  if(!resp.ok) throw new Error("Não foi possível carregar data/normas-wisciv.json");
  NORMAS = await resp.json();
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

function faixaEtaria(normas, idade) {
  if (!idade) return null;
  const total = idade.totalMeses;

  for (const faixa of Object.keys(normas || {})) {
    const [ini, fim] = faixa.split("-");
    if (!ini || !fim) continue;
    const [ai, mi] = ini.split(":").map(Number);
    const [af, mf] = fim.split(":").map(Number);
    if ([ai,mi,af,mf].some(x => Number.isNaN(x))) continue;

    const min = ai * 12 + mi;
    const max = af * 12 + mf;
    if (total >= min && total <= max) return faixa;
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
      await esperarImagensCarregarem(rel);
      const restaurar = aplicarAjustesTemporariosParaPDF(rel);
      await garantirGraficosProntos();
      try{
      // garante imagens e gráficos prontos antes de “tirar foto”
        await garantirGraficosProntos();

        // PDF sem páginas em branco (impressão do navegador)
        await gerarPDFPorImpressao(rel, `WISC-IV_${nome}`);
      }finally{
      restaurar();
    }
      const laudos = getLaudos();
      laudos.unshift({
        nome,
        dataAplicacao: apl,
        faixa,
        createdAt: new Date().toISOString(),
        htmlRelatorio: serializarRelatorioParaSalvar(rel)
      });
      setLaudos(laudos);

      alert("Laudo salvo e PDF gerado.");
    }

  }catch(e){
    console.error(e);
    alert("Erro ao calcular. Verifique normas-wisciv.json em /tests/wisciv/data/.");
  }
}

// ================= RELATÓRIO + GRÁFICOS + PDF =================
let chartSub = null;
let chartIdx = null;

// Desenha banda da média (9–11) e divisórias de grupos no gráfico de subtestes
const WISC_SCATTER_PLUGIN = {
  id: "wiscScatterDecor",
  beforeDraw(chart, args, opts) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;

    // Banda média (9–11)
    if (opts && opts.band && scales?.y) {
      const yTop = scales.y.getPixelForValue(opts.band.max);
      const yBot = scales.y.getPixelForValue(opts.band.min);
      ctx.save();
      ctx.fillStyle = "rgba(13, 71, 161, 0.12)"; // azul translúcido
      ctx.fillRect(chartArea.left, yTop, chartArea.right - chartArea.left, yBot - yTop);
      ctx.restore();
    }

    // Divisórias verticais (grupos)
    if (opts && Array.isArray(opts.vlines) && scales?.x) {
      ctx.save();
      ctx.strokeStyle = "rgba(13, 71, 161, 0.35)";
      ctx.lineWidth = 2;
      opts.vlines.forEach(v => {
        const x = scales.x.getPixelForValue(v);
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
      });
      ctx.restore();
    }

    // Títulos dos grupos (acima do chartArea)
    if (opts && Array.isArray(opts.groupLabels) && scales?.x) {
      ctx.save();
      ctx.fillStyle = "rgba(13, 71, 161, 0.95)";
      ctx.font = "600 12px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      const y = chartArea.top - 10;
      opts.groupLabels.forEach(g => {
        const x1 = scales.x.getPixelForValue(g.from);
        const x2 = scales.x.getPixelForValue(g.to);
        const xc = (x1 + x2) / 2;
        ctx.fillText(g.text, xc, y);
      });
      ctx.restore();
    }
  }
};

function registrarPluginsChart(){
  if (typeof Chart === "undefined") return;
  // evita registrar duas vezes
  const already = Chart.registry?.plugins?.get?.("wiscScatterDecor");
  if (!already) Chart.register(WISC_SCATTER_PLUGIN);
}

function formatarDataISO(iso){
  if(!iso) return "";
  // mantém ISO para consistência no seu sistema, mas permite trocar depois
  return iso;
}

function renderPerfilSubtestes(resultados){
  const grupos = [
    { titulo: "Compreensão Verbal", codes: ["SM","VC","CO","IN","RP"] },
    { titulo: "Organização Perceptual", codes: ["CB","CN","RM","CF"] },
    { titulo: "Memória Operacional", codes: ["DG","SNL","AR"] },
    { titulo: "Velocidade de Proc.", codes: ["CD","PS","CA"] },
  ];
  const supl = new Set(["CF","CA","IN","AR","RP"]);

  const head1 = grupos.map(g => `<th colspan="${g.codes.length}" class="perfil-group">${g.titulo}</th>`).join("");
  const codes = grupos.flatMap(g => g.codes).map(c=>{
    const label = supl.has(c) ? `(${c})` : c;
    return `<th class="perfil-code">${label}</th>`;
  }).join("");
  const vals = grupos.flatMap(g => g.codes).map(c=>{
    const v = resultados?.[c]?.ponderado;
    return `<td class="perfil-val">${v ?? "—"}</td>`;
  }).join("");

  return `
    <table class="perfil-table">
      <thead>
        <tr>${head1}</tr>
        <tr>${codes}</tr>
      </thead>
      <tbody>
        <tr>${vals}</tr>
      </tbody>
    </table>
  `;
}

function montarRelatorio(data) {
  const rel = document.getElementById("relatorio");
  if (!rel) return;

  registrarPluginsChart();

  const { nome, nasc, apl, idade, faixa, resultados, indicesInfo, qiInfo } = data;
  const matriz = renderMatrizConversao({ resultados, indicesInfo, qiInfo });
  const perfil = renderPerfilSubtestes(resultados);

  rel.style.display = "block";
  rel.innerHTML = `
    <div class="report">
      <div class="report-header">
        <img class="report-logo report-logo-top" src="logo2.png" alt="Logo" onerror="this.style.display='none'">
        <div class="report-title">
          <div class="t1">Relatório – WISC-IV</div>
          <div class="t2">Conversão PB → Ponderado e somatórios por índice</div>
        </div>
        <div class="report-meta">
          <div class="badge">Faixa: ${faixa}</div>
          <div class="muted">Idade: ${idade.anos}a ${idade.meses}m</div>
        </div>
      </div>

      <div class="section report-info no-break">
        <div class="info-grid">
          <div><span class="k">Nome:</span> <span class="v">${nome}</span></div>
          <div><span class="k">Nascimento:</span> <span class="v">${formatarDataISO(nasc)}</span></div>
          <div><span class="k">Aplicação:</span> <span class="v">${formatarDataISO(apl)}</span></div>
        </div>
      </div>

      <div class="section no-break">
        <h3>Perfil dos Pontos Ponderados dos Subtestes</h3>
        <div class="perfil-card">
          ${perfil}
          <div class="canvas-wrap perfil-canvas"><canvas id="grafSub" height="220"></canvas></div>
        </div>
        <p class="muted" style="margin:10px 0 0;">
          A faixa azul indica a região média aproximada (9–11) dos pontos ponderados.
        </p>
      </div>

      <div class="section">
        <h3>Conversão PB → Ponderado e contribuição nos Índices</h3>
        <div class="matrix-card no-break">${matriz}</div>
        <p class="muted" style="margin:10px 0 0;">
          Células azuis indicam subtestes usados na soma do índice/QIT. Suplementares podem aparecer entre parênteses.
        </p>
      </div>

      <div class="section">
        <h3>Subtestes (detalhamento)</h3>
        <table class="table">
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
        <div class="canvas-wrap"><canvas id="grafIdx" height="180"></canvas></div>

        <table class="table" style="margin-top:12px;">
          <thead><tr><th>Medida</th><th>Soma (ponderados)</th><th>Subtestes usados</th></tr></thead>
          <tbody>
            ${Object.entries(INDICES).map(([k, def])=>{
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

      <div class="report-footer">
        <div class="muted">Documento gerado automaticamente</div>
        <img class="report-logo report-logo-bottom" src="logo2.png" alt="Logo" onerror="this.style.display='none'">
      </div>
    </div>
  `;

  desenharGraficos(resultados, indicesInfo, qiInfo);
}

function desenharGraficos(resultados, indicesInfo, qiInfo){
  registrarPluginsChart();

  // ---------- Subtestes: SCATTER (pontos) ----------
  const ctxSub = document.getElementById("grafSub");
  if(ctxSub){
    if(chartSub) chartSub.destroy();

    // ordem do perfil (igual ao manual)
    const labels = ["SM","VC","CO","IN","RP","CB","CN","RM","CF","DG","SNL","AR","CD","PS","CA"];
    const points = labels
      .map((c, i) => {
        const v = resultados?.[c]?.ponderado;
        return (v == null) ? null : { x: i+1, y: Number(v) };
      })
      .filter(Boolean);

    chartSub = new Chart(ctxSub, {
      type:"scatter",
      data:{
        datasets:[{
          data: points,
          pointRadius: 5,
          pointHoverRadius: 6,
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{
          legend:{ display:false },
          wiscScatterDecor:{
            band:{ min:9, max:11 },
            vlines:[6, 10, 13],
            groupLabels:[
              { from:1, to:5, text:"Compreensão Verbal" },
              { from:6, to:9, text:"Organização Perceptual" },
              { from:10, to:12, text:"Memória Operacional" },
              { from:13, to:15, text:"Velocidade de Proc." },
            ]
          }
        },
        scales:{
          x:{
            min:0.5, max:15.5,
            grid:{ display:false },
            ticks:{
              autoSkip:false,
              callback:(val)=> {
                const idx = Math.round(val)-1;
                const c = labels[idx];
                if(!c) return "";
                return ["CF","CA","IN","AR","RP"].includes(c) ? `(${c})` : c;
              }
            }
          },
          y:{
            min:1, max:19,
            ticks:{ stepSize:1 },
          }
        }
      }
    });
  }

  // ---------- Índices e QIT: pontos ----------
  const ctxIdx = document.getElementById("grafIdx");
  if(ctxIdx){
    if(chartIdx) chartIdx.destroy();
    const labels = ["ICV","IOP","IMO","IVP","QIT"];
    const vals = [
      indicesInfo?.ICV?.soma ?? null,
      indicesInfo?.IOP?.soma ?? null,
      indicesInfo?.IMO?.soma ?? null,
      indicesInfo?.IVP?.soma ?? null,
      qiInfo?.soma ?? null,
    ];
    const pts = vals.map((v,i)=> v==null ? null : ({x:i+1, y:Number(v)})).filter(Boolean);

    chartIdx = new Chart(ctxIdx, {
      type:"scatter",
      data:{ datasets:[{ data: pts, pointRadius:5, pointHoverRadius:6 }] },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{ legend:{ display:false } },
        scales:{
          x:{
            min:0.5, max:5.5,
            grid:{ display:false },
            ticks:{
              autoSkip:false,
              callback:(val)=>{
                const idx=Math.round(val)-1;
                return labels[idx] || "";
              }
            }
          },
          y:{ beginAtZero:true }
        }
      }
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


// ===== PDF helpers (não altera cálculo nem fluxo) =====
async function esperarImagensCarregarem(container){
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  }));
}

// ================================
// PDF SUPER ESTÁVEL (sem páginas em branco)
// - Converte <canvas> (Chart.js) em <img> antes do PDF
// - Usa impressão do navegador em janela limpa (melhor que html2pdf/html2canvas)
// ================================

// Clona um elemento e substitui canvases por imagens (dataURL) para preservar os gráficos no PDF
function clonarComCanvasComoImagem(sourceEl){
  const clone = sourceEl.cloneNode(true);

  const srcCanvases = Array.from(sourceEl.querySelectorAll("canvas"));
  const dstCanvases = Array.from(clone.querySelectorAll("canvas"));

  for(let i = 0; i < Math.min(srcCanvases.length, dstCanvases.length); i++){
    const src = srcCanvases[i];
    const dst = dstCanvases[i];

    try{
      const data = src.toDataURL("image/png");
      const img = document.createElement("img");
      img.src = data;
      img.style.width = (src.style.width || "100%");
      img.style.maxWidth = "100%";
      img.style.display = "block";

      // mantém altura aproximada (se existir)
      if (src.getAttribute("height")) img.style.height = "auto";

      dst.replaceWith(img);
    }catch(e){
      // se falhar, mantém o canvas original
    }
  }
  return clone;
}

// Serializa HTML do relatório já com os gráficos como imagem (ideal para salvar no localStorage)
function serializarRelatorioParaSalvar(relEl){
  const wrapper = document.createElement("div");
  wrapper.appendChild(clonarComCanvasComoImagem(relEl));
  return wrapper.innerHTML;
}

// Gera PDF via impressão do navegador (mais confiável que html2pdf)
async function gerarPDFPorImpressao(relEl, tituloArquivo){
  const win = window.open("", "_blank");
  if(!win){
    alert("O navegador bloqueou a janela de impressão. Permita pop-ups para este site para gerar o PDF.");
    return;
  }

  // copia CSS (links e <style>) do documento atual para a janela de impressão
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map(n => n.outerHTML)
    .join("\n");

  // clona relatório e converte canvases -> imgs (para não ficar branco)
  const clone = clonarComCanvasComoImagem(relEl);

  win.document.open();
  win.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${tituloArquivo || "Relatorio_WISC-IV"}</title>
  ${styles}
  <style>
    @page{ size:A4; margin:10mm; }
    html, body{ background:#fff !important; }
    /* Evita cortes ruins, mas sem empurrar blocos criando "buracos" */
    .no-break{ break-inside: avoid; page-break-inside: avoid; }
    /* Em impressão, não queremos overflow/scroll em cards */
    .matrix-card, .perfil-card{ overflow: visible !important; }
    thead, th{ position: static !important; }
  </style>
</head>
<body>
  <div id="print-root"></div>
</body>
</html>`);
  win.document.close();

  const root = win.document.getElementById("print-root");
  root.appendChild(win.document.importNode(clone, true));

  // espera imagens (logos e imgs geradas dos canvases) carregarem
  const imgs = Array.from(win.document.querySelectorAll("img"));
  await Promise.all(imgs.map(img => {
    if(img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
  }));

  // pequena pausa para layout estabilizar
  await new Promise(r => setTimeout(r, 150));

  win.focus();
  win.print();

  setTimeout(() => { try{ win.close(); }catch(e){} }, 600);
}


function aplicarAjustesTemporariosParaPDF(container){
  // Remove comportamentos que quebram paginação do html2pdf/html2canvas (somente durante exportação)
  const touched = [];
  const set = (el, prop, val) => {
    touched.push([el, prop, el.style[prop]]);
    el.style[prop] = val;
  };

  // Overflow/scroll costuma gerar páginas vazias
  container.querySelectorAll(".matrix-card, .perfil-card").forEach(el => {
    set(el, "overflow", "visible");
  });

  // Evitar "break-inside: avoid" empurrando cards inteiros e criando grandes vazios
  container.querySelectorAll(".no-break, .card, .section").forEach(el => {
    set(el, "breakInside", "auto");
    set(el, "pageBreakInside", "auto");
  });

  // Tabelas com sticky header podem dar altura errada no canvas
  container.querySelectorAll("thead, th").forEach(el => {
    set(el, "position", "static");
  });

  return () => {
    for (let i = touched.length - 1; i >= 0; i--){
      const [el, prop, prev] = touched[i];
      el.style[prop] = prev || "";
    }
  };
}

async function garantirGraficosProntos(){
  // força Chart.js finalizar desenho antes do html2canvas capturar
  try{
    if (chartSub){
      chartSub.options.animation = false;
      chartSub.update("none");
    }
    if (chartIdx){
      chartIdx.options.animation = false;
      chartIdx.update("none");
    }
  }catch(e){ /* noop */ }

  // espera 2 frames para o canvas estabilizar (Windows/iOS)
  await new Promise(r => requestAnimationFrame(()=>requestAnimationFrame(r)));
  // micro delay extra
  await new Promise(r => setTimeout(r, 80));
}


async function baixarPDFSalvo(index){
  const laudos = getLaudos();
  const item = laudos[index];
  if(!item) return alert("Laudo não encontrado.");

  const temp = document.createElement("div");
  temp.innerHTML = item.htmlRelatorio;
  document.body.appendChild(temp);

  await esperarImagensCarregarem(temp);

  // usa impressão do navegador (sem páginas em branco)
  await gerarPDFPorImpressao(temp, `WISC-IV_${item.nome}`);

  temp.remove();
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
