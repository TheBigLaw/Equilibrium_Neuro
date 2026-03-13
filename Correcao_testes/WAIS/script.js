console.log("SCRIPT WAIS CARREGADO v3");
const LAUDOS_KEY = "empresa_laudos_wais";

const SUBTESTES = [
  { nome: "Completar Figuras", codigo: "CF", id: "pb_CF" },
  { nome: "Vocabulário", codigo: "VC", id: "pb_VC" },
  { nome: "Códigos", codigo: "CD", id: "pb_CD" },
  { nome: "Semelhanças", codigo: "SM", id: "pb_SM" },
  { nome: "Cubos", codigo: "CB", id: "pb_CB" },
  { nome: "Aritmética", codigo: "AR", id: "pb_AR" },
  { nome: "Raciocínio Matricial", codigo: "RM", id: "pb_RM" },
  { nome: "Dígitos", codigo: "DG", id: "pb_DG" },
  { nome: "Informação", codigo: "IN", id: "pb_IN" },
  { nome: "Arranjo de Figuras", codigo: "AF", id: "pb_AF" },
  { nome: "Compreensão", codigo: "CO", id: "pb_CO" },
  { nome: "Procurar Símbolos", codigo: "PS", id: "pb_PS" },
  { nome: "Sequência de Números e Letras", codigo: "SNL", id: "pb_SNL" },
  { nome: "Armar Objetos", codigo: "AO", id: "pb_AO" },
];

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

function faixaEtariaWAISIII(idade){
  if(!idade) return null;
  const anos = idade.anos;
  if (anos >= 16 && anos <= 17) return "16 - 17";
  if (anos >= 18 && anos <= 19) return "18 - 19";
  if (anos >= 20 && anos <= 29) return "20 - 29";
  if (anos >= 30 && anos <= 39) return "30 - 39";
  if (anos >= 40 && anos <= 49) return "40 - 49";
  if (anos >= 50 && anos <= 59) return "50 - 59";
  if (anos >= 60 && anos <= 64) return "60 - 64";
  if (anos >= 65 && anos <= 89) return "65 - 89";
  return null;
}

function obterNomeSubteste(codigo){
  const map = {
    CB:"Cubos", SM:"Semelhanças", DG:"Dígitos", CN:"Conceitos Figurativos", CD:"Código",
    VC:"Vocabulário", SNL:"Seq. Núm. e Letras", RM:"Raciocínio Matricial", CO:"Compreensão",
    PS:"Procurar Símbolos", CF:"Completar Figuras", CA:"Cancelamento", IN:"Informação",
    AR:"Aritmética", RP:"Raciocínio com Palavras", AF:"Arranjo de Figuras", AO:"Armar Objetos",
  };
  return map[codigo] || codigo;
}

function cellIndice(codigo, usadosSet, possiveisSet, resultados){
  if(!possiveisSet || !possiveisSet.has(codigo)) return `<td class="idx fill"></td>`;
  const r = resultados?.[codigo];
  const v = r?.ponderado;
  if(v == null || v === "") return `<td class="idx fill"></td>`;
  const suplementar = !(usadosSet && usadosSet.has(codigo));
  const cls = suplementar ? "pill sup" : "pill";
  const txt = suplementar ? `(${v})` : `${v}`;
  return `<td class="idx fill"><span class="${cls}">${txt}</span></td>`;
}

function renderMatrizConversao({ resultados, indicesInfo, somas }) {
  const usadosICV = new Set(indicesInfo?.ICV?.usados || []);
  const usadosIOP = new Set(indicesInfo?.IOP?.usados || []);
  const usadosIMO = new Set(indicesInfo?.IMO?.usados || []);
  const usadosIVP = new Set(indicesInfo?.IVP?.usados || []);
  const usadosVERBAL = new Set(somas?.QI_VERBAL?.usados || []);
  const usadosEXEC   = new Set(somas?.QI_EXECUCAO?.usados || []);

  const possiveis = {
    VERBAL: new Set(["VC","SM","AR","DG","IN","CO","SNL"]),
    EXEC:   new Set(["CF","CD","CB","RM","AF","PS","AO"]),
    ICV:    new Set(["SM","VC","IN","CO"]),
    IOP:    new Set(["CB","CF","RM","AF"]),
    IMO:    new Set(["AR","DG","SNL"]),
    IVP:    new Set(["CD","PS"]),
  };

  const ordem = ["CF","VC","CD","SM","CB","AR","RM","DG","IN","AF","CO","PS","SNL","AO"];

  const linhas = ordem.map(codigo => {
    const r = resultados[codigo] || { bruto: "", ponderado: "" };
    const nome = obterNomeSubteste(codigo);
    return `
      <tr>
        <td class="col-sub"><b>${nome}</b> <span class="muted">(${codigo})</span></td>
        <td class="col-pb">${r.bruto ?? ""}</td>
        <td class="col-pp">${r.ponderado ?? ""}</td>
          ${cellIndice(codigo, usadosVERBAL, possiveis.VERBAL, resultados)}
          ${cellIndice(codigo, usadosEXEC,   possiveis.EXEC,   resultados)}
          ${cellIndice(codigo, usadosICV,    possiveis.ICV,    resultados)}
          ${cellIndice(codigo, usadosIOP,    possiveis.IOP,    resultados)}
          ${cellIndice(codigo, usadosIMO,    possiveis.IMO,    resultados)}
          ${cellIndice(codigo, usadosIVP,    possiveis.IVP,    resultados)}
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
        <th colspan="6">Contribuição (Pontos Ponderados)</th>
      </tr>
      <tr>
        <th></th><th></th><th></th>
        <th class="idx">Verbal</th>
        <th class="idx">Exec.</th>
        <th class="idx">ICV</th>
        <th class="idx">IOP</th>
        <th class="idx">IMO</th>
        <th class="idx">IVP</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
    <tfoot>
      <tr>
        <td class="sum-label" colspan="3">Soma dos Pontos Ponderados</td>
        <td>${somas?.QI_VERBAL?.soma ?? "—"}</td>
        <td>${somas?.QI_EXECUCAO?.soma ?? "—"}</td>
        <td>${indicesInfo?.ICV?.soma ?? "—"}</td>
        <td>${indicesInfo?.IOP?.soma ?? "—"}</td>
        <td>${indicesInfo?.IMO?.soma ?? "—"}</td>
        <td>${indicesInfo?.IVP?.soma ?? "—"}</td>
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
  const faixa = faixaEtariaWAISIII(idade);
  faixaEl.textContent = faixa ? `Faixa normativa: ${faixa}` : "Faixa normativa: não encontrada.";
}

function getLaudos(){ return JSON.parse(localStorage.getItem(LAUDOS_KEY) || "[]"); }
function setLaudos(arr){ localStorage.setItem(LAUDOS_KEY, JSON.stringify(arr)); }
function limparCPF(cpf){ return (cpf || "").replace(/\D/g, ""); }

function validarCPF(cpfInput){
  const cpf = limparCPF(cpfInput);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(cpf[i]) * (10 - i);
  let d1 = (soma * 10) % 11;
  if (d1 === 10) d1 = 0;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(cpf[i]) * (11 - i);
  let d2 = (soma * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

// === A FUNÇÃO QUE CONECTA COM A API ===
async function calcular(salvar){
  try{
    const nome = (document.getElementById("nome")?.value || "").trim();
    const nasc = document.getElementById("dataNascimento")?.value;
    const apl  = document.getElementById("dataAplicacao")?.value;
    const cpf = (document.getElementById("cpf")?.value || "").trim();
    const sexo = document.getElementById("sexo")?.value || "";
    const escolaridade = document.getElementById("escolaridade")?.value || "";

    if(!nome || !nasc || !apl){ alert("Preencha Nome, Nascimento e Aplicação."); return; }
    if(!cpf || !sexo || !escolaridade){alert("Preencha CPF, sexo e escolaridade.");return;}
    if(!validarCPF(cpf)){alert("CPF inválido. Verifique e tente novamente.");return;}

    const brutos = {};
    for(const s of SUBTESTES){
      const v = document.getElementById(s.id)?.value;
      if(v !== "" && v != null) {
        const bruto = Number(v);
        if(Number.isNaN(bruto) || bruto < 0){ alert(`Valor inválido em ${s.nome}`); return; }
        brutos[s.codigo] = bruto;
      }
    }

    if(Object.keys(brutos).length === 0){ alert("Preencha ao menos um subteste."); return; }

    // ATENÇÃO: COLOQUE AQUI O LINK DO RENDER!
    const API_URL = "https://equilibrium-api-yjxx.onrender.com/wais/calcular"; 

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nasc, apl, brutos })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
        throw new Error(data.error || "Erro desconhecido ao processar teste na API.");
    }

    const { idade, faixa, resultados, somas, compostos, indicesInfo, qiInfo } = data.resultado;

    montarRelatorio({ nome, cpf, sexo, escolaridade, nasc, apl, idade, faixa, resultados, indicesInfo, qiInfo, somas, compostos});

    if(salvar){
      const rel = document.getElementById("relatorio");
      await esperarImagensCarregarem(rel);
      await new Promise(r => setTimeout(r, 150));
      const laudos = getLaudos();
      laudos.unshift({
        nome, dataAplicacao: apl, faixa,
        createdAt: new Date().toISOString(), htmlRelatorio: rel.outerHTML
      });
      setLaudos(laudos);
      alert("Laudo salvo!");
    }
  } catch(e){
    console.error(e);
    alert(`Erro ao calcular: ${e.message}`);
  }
}
// ==========================================

let chartSub = null;
let chartIdx = null;

const WISC_SCATTER_PLUGIN = {
  id: "wiscScatterDecor",
  beforeDraw(chart, args, opts) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;
    if (opts && opts.band && scales?.y) {
      const yTop = scales.y.getPixelForValue(opts.band.max);
      const yBot = scales.y.getPixelForValue(opts.band.min);
      ctx.save();
      ctx.fillStyle = "rgba(13, 71, 161, 0.12)";
      ctx.fillRect(chartArea.left, yTop, chartArea.right - chartArea.left, yBot - yTop);
      ctx.restore();
    }
    if (opts && Array.isArray(opts.vlines) && scales?.x) {
      ctx.save();
      ctx.strokeStyle = "rgba(13, 71, 161, 0.35)";
      ctx.lineWidth = 2;
      opts.vlines.forEach(v => {
        const x = scales.x.getPixelForValue(v);
        ctx.beginPath(); ctx.moveTo(x, chartArea.top); ctx.lineTo(x, chartArea.bottom); ctx.stroke();
      });
      ctx.restore();
    }
  }
};

function registrarPluginsChart(){
  if (typeof Chart === "undefined") return;
  const already = Chart.registry?.plugins?.get?.("wiscScatterDecor");
  if (!already) Chart.register(WISC_SCATTER_PLUGIN);
}

function formatarDataISO(iso){ return iso; }

function renderPerfilSubtestes(resultados){
  const grupos = [
    { titulo: "Compreensão Verbal",      codes: ["SM","VC","IN","CO"] },
    { titulo: "Organização Perceptual",  codes: ["CB","CF","RM","AF"] },
    { titulo: "Memória Operacional",     codes: ["AR","DG","SNL"] },
    { titulo: "Velocidade de Proc.",     codes: ["CD","PS"] },
  ];
  const supl = new Set(["SNL","AO"]);
  const head1 = grupos.map(g => `<th colspan="${g.codes.length}" class="perfil-group">${g.titulo}</th>`).join("");
  const codes = grupos.flatMap(g => g.codes).map(c=>{
    const label = supl.has(c) ? `(${c})` : c;
    return `<th class="perfil-code">${label}</th>`;
  }).join("");
  const vals = grupos.flatMap(g => g.codes).map(c=>{
    const v = resultados?.[c]?.ponderado;
    return `<td class="perfil-val">${v ?? "—"}</td>`;
  }).join("");
  return `<table class="perfil-table"><thead><tr>${head1}</tr><tr>${codes}</tr></thead><tbody><tr>${vals}</tr></tbody></table>`;
}

function formatarCPF(cpf){
  if(!cpf) return "";
  const nums = cpf.replace(/\D/g, "");
  if(nums.length !== 11) return cpf;
  return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function montarRelatorio(data) {
  const rel = document.getElementById("relatorio");
  if (!rel) return;
  registrarPluginsChart();

  function fmtIC(arr){ return !Array.isArray(arr) ? "—" : `${arr[0]}–${arr[1]}`; }

  const { nome, cpf, sexo, escolaridade, nasc, apl, idade, faixa, resultados, indicesInfo, qiInfo, compostos, somas } = data;
  const textoInterp = gerarTextoInterpretativo({ nome, compostos });
  const cpfTxt = formatarCPF(cpf);
  const matriz = renderMatrizConversao({ resultados, indicesInfo, somas });
  const perfil = renderPerfilSubtestes(resultados);

  rel.style.display = "block";
  rel.innerHTML = `
    <div class="report">
      <div class="report-header">
        <img class="report-logo report-logo-top" src="/logo2.png" alt="Logo" onerror="this.style.display='none'">
        <div class="report-title">
          <div class="t1">Relatório – WAIS</div>
          <div class="t2">Conversão PB → Ponderado e somatórios por índice</div>
        </div>
        <div class="report-meta"><div class="badge">Faixa: ${faixa}</div><div class="muted">Idade: ${idade.anos}a ${idade.meses}m</div></div>
      </div>
      <div class="section">
        <div class="info-grid">
          <div><span class="k">Nome:</span> <span class="v">${nome}</span></div>
          <div><span class="k">CPF:</span> <span class="v">${cpfTxt || "—"}</span></div>
          <div><span class="k">Sexo:</span> <span class="v">${sexo || "—"}</span></div>
          <div><span class="k">Escolaridade:</span> <span class="v">${escolaridade || "—"}</span></div>
          <div><span class="k">Nascimento:</span> <span class="v">${nasc}</span></div>
          <div><span class="k">Aplicação:</span> <span class="v">${apl}</span></div>
        </div>
      </div>
      <div class="duas-colunas">
        <div class="section no-break">
          <h3>Conversão PB → Ponderado e contribuição nos Índices</h3>
          <div class="matrix-card">${matriz}</div>
          <p class="muted" style="margin:10px 0 0;">Células azuis indicam subtestes usados na soma do índice/QIT. Suplementares podem aparecer entre parênteses.</p>
        </div>
        <div class="section no-break">
          <h3>Perfil dos Pontos Ponderados dos Subtestes</h3>
          <div class="perfil-card">
            ${perfil}
            <div class="canvas-wrap perfil-canvas"><canvas id="grafSub" height="560"></canvas></div>
          </div>
          <p class="muted" style="margin:10px 0 0;">A faixa azul indica a região média aproximada (9–11) dos pontos ponderados.</p>
        </div>
      </div>
      <div class="duas-colunas">
        <div class="section no-break">
          <h3>Subtestes (detalhamento)</h3>
          <table class="table">
            <thead><tr><th>Subteste</th><th>PB</th><th>Ponderado</th><th>Classificação</th></tr></thead>
            <tbody>
              ${Object.values(resultados).map(r=>`<tr><td><b>${r.nome}</b> <span class="muted">(${r.codigo})</span></td><td>${r.bruto}</td><td>${r.ponderado}</td><td>${r.classificacao}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
        <div class="section no-break">
          <h3>Índices e QI Total</h3>
          <div class="canvas-wrap"><canvas id="grafIdx" height="300"></canvas></div>
          <table class="table" style="margin-top:12px;">
          <thead><tr><th>Escala</th><th>Soma ponderados</th><th>QI / Índice</th><th>Rank Percentil</th><th>IC 90%</th><th>IC 95%</th></tr></thead>
          <tbody>
              ${[["QIV", "QI_VERBAL"],["QIE", "QI_EXECUCAO"],["QIT", "QI_TOTAL"],["ICV", "ICV"],["IOP", "IOP"],["IMO", "IMO"],["IVP", "IVP"]].map(([rotulo, chave]) => {
                const s = somas?.[chave]; const c = compostos?.[chave];
                return `<tr><td>${rotulo}</td><td>${s?.soma ?? "—"}</td><td>${c?.composto ?? "—"}</td><td>${c?.percentil ?? "—"}</td><td>${fmtIC(c?.ic90)}</td><td>${fmtIC(c?.ic95)}</td></tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
      <div class="section no-break">
        <h3>Interpretação (síntese)</h3>
        ${textoInterp.split("\n\n").map(p => `<p class="interp">${p}</p>`).join("")}
      </div>
      <div class="report-footer">
        <div class="muted">Documento gerado automaticamente</div>
        <button class="btn-print no-print" onclick="imprimirRelatorio()">Imprimir (PDF)</button>
        <img class="report-logo report-logo-bottom" src="/logo2.png" alt="Logo" onerror="this.style.display='none'">
      </div>
    </div>`;
  desenharGraficos(resultados, indicesInfo, qiInfo, compostos);
}

function desenharGraficos(resultados, indicesInfo, qiInfo, compostos){
  registrarPluginsChart();
  const ctxSub = document.getElementById("grafSub");
  if(ctxSub){
    if(chartSub) chartSub.destroy();
    const groups = [ ["SM","VC","IN","CO"], ["CB","CF","RM","AF"], ["AR","DG","SNL"], ["CD","PS"], ["AO"] ];
    let x = 1; const xPos = {}; const tickAt = [];
    groups.forEach((g, gi) => {
      g.forEach(code => { xPos[code] = x; tickAt[x] = code; x++; });
      if (gi < groups.length - 1) x += 1;
    });
    const points = Object.keys(xPos).map(code => {
      const v = resultados?.[code]?.ponderado;
      return (v == null) ? null : { x: xPos[code], y: Number(v) };
    }).filter(Boolean);
    chartSub = new Chart(ctxSub, {
      type:"scatter",
      data:{ datasets:[{ data: points, pointRadius: 5, pointHoverRadius: 6 }] },
      options:{
        responsive:true, maintainAspectRatio:false, layout: { padding: { left: 6, right: 6, top: 18, bottom: 6 } },
        plugins:{ legend:{ display:false }, wiscScatterDecor:{ band:{ min:9, max:11 }, vlines: [5.5, 10.5, 14.5, 17.5] } },
        scales:{
          x:{ type: "linear", min: 0.5, max: x - 0.5, grid:{ display:false },
            ticks: { font: { size: 10 }, maxRotation: 0, minRotation: 0, padding: 6, stepSize: 1, autoSkip: false,
              callback: (val) => {
                const code = tickAt[Math.round(val)];
                if (!code) return "";
                return ["SNL","AO"].includes(code) ? `(${code})` : code;
              }
            }
          },
          y:{ min:1, max:19, grid:{ color: "rgba(13,71,161,.10)" }, ticks:{ stepSize:1, font: { size: 10 } } }
        }
      }
    });
  }

  const ctxIdx = document.getElementById("grafIdx");
  if(ctxIdx){
    if(chartIdx) chartIdx.destroy();
    const labels = ["QIV","QIE","QIT","ICV","IOP","IMO","IVP"];
    const vals = [ compostos?.QI_VERBAL?.composto, compostos?.QI_EXECUCAO?.composto, compostos?.QI_TOTAL?.composto, compostos?.ICV?.composto, compostos?.IOP?.composto, compostos?.IMO?.composto, compostos?.IVP?.composto ];
    const pts = vals.map((v,i)=> v==null ? null : ({x:i+1, y:Number(v)})).filter(Boolean);
    chartIdx = new Chart(ctxIdx, {
      type:"scatter",
      data:{ datasets:[{ data: pts, pointRadius:5, pointHoverRadius:6 }] },
      options:{
        responsive:true, maintainAspectRatio:false, layout: { padding: { left: 6, right: 6, top: 6, bottom: 6 } },
        plugins:{ legend:{ display:false } },
        scales:{
          x:{ min: 0.5, max: labels.length + 0.5, grid:{ display:false },
            ticks:{ autoSkip:false, font:{ size: 10 }, callback:(val)=>{ return labels[Math.round(val)-1] || ""; } }
          },
          y:{ suggestedMin: 40, suggestedMax: 160, ticks:{ font:{ size: 10 } }, grid:{ color:"rgba(13,71,161,.10)" } }
        }
      }
    });
  }
}

function renderListaLaudos(){
  const box = document.getElementById("listaLaudos");
  if(!box) return;
  const laudos = getLaudos();
  if(!laudos.length){ box.innerHTML = `<p class="muted">Nenhum laudo salvo ainda.</p>`; return; }
  box.innerHTML = `<table class="table"><thead><tr><th>Paciente</th><th>Aplicação</th><th>Faixa</th><th>Ações</th></tr></thead><tbody>${laudos.map((x, idx)=>`<tr><td>${x.nome}</td><td>${x.dataAplicacao}</td><td><span class="badge">${x.faixa}</span></td><td><button class="btn-outline" onclick="baixarPDFSalvo(${idx})">Baixar PDF</button></td></tr>`).join("")}</tbody></table>`;
}

async function esperarImagensCarregarem(container){
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); });
  }));
}

function pctText(p){ return (p == null || p === "" || Number.isNaN(+p)) ? "—" : `${+p} %`; }
function fmtICRange(ic){
  if(!ic) return "—";
  if(Array.isArray(ic)) return `${ic[0]}–${ic[1]}`;
  return String(ic).replace(",", "–");
}

function classByComposite(score){
  const s = +score;
  if(Number.isNaN(s)) return null;
  if(s >= 130) return "Muito Superior";
  if(s >= 120) return "Superior";
  if(s >= 110) return "Médio Superior";
  if(s >= 90)  return "Médio";
  if(s >= 80)  return "Médio Inferior";
  if(s >= 70)  return "Limítrofe";
  return "Extremamente Baixo";
}

function introVerbByClass(cls){
  const map = { "Muito Superior": "situa-se muito acima", "Superior": "situa-se acima", "Médio Superior": "situa-se acima", "Médio": "situa-se na faixa média", "Médio Inferior": "situa-se ligeiramente abaixo", "Limítrofe": "situa-se abaixo", "Extremamente Baixo": "situa-se muito abaixo" };
  return map[cls] || "situa-se";
}

function scaleLabelLong(key){
  const map = { QI_TOTAL: "QI Total (QIT)", QI_VERBAL: "QI Verbal (QIV)", QI_EXECUCAO: "QI de Execução (QIE)", ICV: "Índice de Compreensão Verbal (ICV)", IOP: "Índice de Organização Perceptual (IOP)", IMO: "Índice de Memória Operacional (IMO)", IVP: "Índice de Velocidade de Processamento (IVP)" };
  return map[key] || key;
}

function abilityDescription(key){
  const map = { QI_TOTAL: "funcionamento intelectual global", QI_VERBAL: "conhecimento adquirido, raciocínio verbal e atenção a materiais verbais", QI_EXECUCAO: "raciocínio fluido, processamento espacial, atenção a detalhes e integração visomotora", ICV: "raciocínio verbal e formação de conceitos", IOP: "raciocínio não verbal, atenção a detalhes e integração visomotora", IMO: "atenção, concentração e controle mental para manipular informações", IVP: "rapidez e eficiência para processar informações visuais simples" };
  return map[key] || "habilidades cognitivas avaliadas";
}

function makeParagraph({ nome, key, comp, percentil, ic95 }){
  const cls = classByComposite(comp);
  const verb = introVerbByClass(cls);
  const label = scaleLabelLong(key);
  const abil = abilityDescription(key);
  const openings = [ `${nome}, ${label}:`, `Quanto ao ${label},`, `Em relação ao ${label},` ];
  const open = openings[Math.floor(Math.random() * openings.length)];
  const pTxt = pctText(percentil);
  const icTxt = fmtICRange(ic95);
  return `${open} as habilidades relacionadas a ${abil} ${verb} em comparação a pessoas de mesma faixa etária (pontuação composta = ${comp}; percentil ≈ ${pTxt}; IC 95% = ${icTxt}${cls ? `; classificação: ${cls}` : ""}).`;
}

function gerarTextoInterpretativo({ nome, compostos }){
  const keys = ["QI_TOTAL","QI_VERBAL","QI_EXECUCAO","ICV","IOP","IMO","IVP"];
  const parts = [];
  for(const key of keys){
    const c = compostos?.[key];
    if(!c?.composto) continue;
    parts.push(makeParagraph({ nome, key, comp: c.composto, percentil: c.percentil, ic95: c.ic95 }));
  }
  return parts.join("\n\n");
}

async function baixarPDFSalvo(index){
  const laudos = getLaudos();
  const item = laudos[index];
  if(!item) return alert("Laudo não encontrado.");
  const temp = document.createElement("div");
  temp.innerHTML = item.htmlRelatorio;
  document.body.appendChild(temp);
  await esperarImagensCarregarem(temp);
  await new Promise(r => setTimeout(r, 150));
  temp.remove();
}

(function init(){
  if(document.getElementById("tbodySubtestes")){
    montarInputsSubtestes();
    document.getElementById("dataNascimento")?.addEventListener("change", atualizarPreviewIdade);
    document.getElementById("dataAplicacao")?.addEventListener("change", atualizarPreviewIdade);
  }
  if(document.getElementById("listaLaudos")){
    renderListaLaudos();
  }
})();

async function imprimirRelatorio(){
  const rel = document.getElementById("relatorio");
  if(!rel) return;
  await esperarImagensCarregarem(rel);
  await new Promise(r => setTimeout(r, 250));
  window.print();
}
