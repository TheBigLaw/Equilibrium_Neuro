
console.log("SCRIPT WAIS CARREGADO v3");
// tests/wais/script.js

const LAUDOS_KEY = "empresa_laudos_wais";

let NORMAS = null;

// novos: normas WAIS-III (as que você subiu na pasta /data)
let RAW_NORMS = null;
let COMP_NORMS = null;

async function carregarNormas(){
  if (RAW_NORMS && COMP_NORMS) {
    return { rawNorms: RAW_NORMS, compNorms: COMP_NORMS };
  }

  const [rawResp, compResp] = await Promise.all([
    fetch("./data/waisiii_raw_to_scaled_br.json", { cache:"no-store" }),
    fetch("./data/waisiii_sum_to_composite_br.json", { cache:"no-store" }),
  ]);

  if(!rawResp.ok) throw new Error("Não foi possível carregar ./data/waisiii_raw_to_scaled_br.json");
  if(!compResp.ok) throw new Error("Não foi possível carregar ./data/waisiii_sum_to_composite_br.json");

  RAW_NORMS = await rawResp.json();
  COMP_NORMS = await compResp.json();

  return { rawNorms: RAW_NORMS, compNorms: COMP_NORMS };
}

// Subtestes WAIS-III (BR) — Verbais + Execução
const SUBTESTES = [
  // VERBAIS
  { nome: "Vocabulário", codigo: "VC", id: "pb_VC" },
  { nome: "Semelhanças", codigo: "SM", id: "pb_SM" },
  { nome: "Aritmética", codigo: "AR", id: "pb_AR" },
  { nome: "Dígitos", codigo: "DG", id: "pb_DG" },
  { nome: "Informação", codigo: "IN", id: "pb_IN" },
  { nome: "Compreensão", codigo: "CO", id: "pb_CO" },
  { nome: "Sequência de Números e Letras", codigo: "SNL", id: "pb_SNL" },

  // EXECUÇÃO
  { nome: "Completar Figuras", codigo: "CF", id: "pb_CF" },
  { nome: "Códigos", codigo: "CD", id: "pb_CD" },
  { nome: "Cubos", codigo: "CB", id: "pb_CB" },
  { nome: "Raciocínio Matricial", codigo: "RM", id: "pb_RM" },
  { nome: "Arranjo de Figuras", codigo: "AF", id: "pb_AF" },
  { nome: "Procurar Símbolos", codigo: "PS", id: "pb_PS" },
  { nome: "Armar Objetos", codigo: "AO", id: "pb_AO" },
];

// WAIS-III — composição das escalas (usando seus códigos)
const WAIS_SCALES = {
  // Índices fatoriais
  ICV: ["SM", "VC", "IN", "CO"],      // Compreensão Verbal
  IOP: ["CB", "CF", "RM", "AF"],      // Organização Perceptual
  IMO: ["AR", "DG", "SNL"],           // Memória Operacional
  IVP: ["CD", "PS"],                 // Velocidade de Processamento

  // QIs (clássicos)
  QI_VERBAL: ["SM", "VC", "AR", "DG", "IN", "CO"],          // sem SNL
  QI_EXECUCAO: ["CF", "CD", "CB", "RM", "AF", "PS"],        // sem AO
  QI_TOTAL: ["SM","VC","AR","DG","IN","CO","CF","CD","CB","RM","AF","PS"], // 12 subtestes
};

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

function faixaEtaria(normas, idade) {
  if (!idade || !normas) return null;

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
  if (!normas?.[faixa]?.subtestes?.[codigo]) return null;

  const regras = normas[faixa].subtestes[codigo];
  if (!Array.isArray(regras)) return null;

  const r = regras.find(x => bruto >= x.min && bruto <= x.max);
  return r ? Number(r.ponderado) : null;
}

function rawToScaledWAIS(rawNorms, faixa, codigo, bruto) {
  const faixaData = rawNorms?.raw_to_scaled?.[faixa];
  if (!faixaData) return null;

  const sub = SUBTESTES.find(s => s.codigo === codigo);
  const nome = sub?.nome;
  if (!nome) return null;

  const regras = faixaData[nome]; // ✅ bate com o JSON
  if (!Array.isArray(regras)) return null;

  for (const r of regras) {
    if (r.rawMin != null && bruto >= r.rawMin && bruto <= r.rawMax) {
      return Number(r.scaled);
    }
  }
  return null;
}

function sumToCompositeWAIS(compNorms, scaleType, soma) {
  const list = compNorms?.sum_to_composite || [];
  const row = list.find(r => r.scale_type === scaleType && soma >= r.sum_min && soma <= r.sum_max);
  if (!row) return null;

  return {
    composto: row.composite_score,
    percentil: row.percentile,
    ic90: [row.ci_90_min, row.ci_90_max],
    ic95: [row.ci_95_min, row.ci_95_max],
  };
}

function somarEscala(pondByCode, codigos){
  let soma = 0;
  const usados = [];
  const faltando = [];

  for(const c of codigos){
    const v = pondByCode[c];
    if(typeof v === "number" && !Number.isNaN(v)){
      soma += v;
      usados.push(c);      // ✅ agora é array
    } else {
      faltando.push(c);
    }
  }

  return {
    soma,
    usados,               // ✅ compatível com renderMatrizConversao
    faltando,
    usadosCount: usados.length,
    total: codigos.length
  };
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

  const idade = calcularIdade(nasc, apl); // ✅ aqui
  if(!idade){ idadeEl.textContent="Datas inválidas."; faixaEl.textContent=""; return; }

  idadeEl.textContent = `Idade na aplicação: ${idade.anos} anos e ${idade.meses} meses.`;

  const faixa = faixaEtariaWAISIII(idade);
  faixaEl.textContent = faixa ? `Faixa normativa: ${faixa}` : "Faixa normativa: não encontrada.";
}

function getLaudos(){
  return JSON.parse(localStorage.getItem(LAUDOS_KEY) || "[]");
}
function setLaudos(arr){
  localStorage.setItem(LAUDOS_KEY, JSON.stringify(arr));
}

function limparCPF(cpf){
  return (cpf || "").replace(/\D/g, "");
}

function validarCPF(cpfInput){
  const cpf = limparCPF(cpfInput);

  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++){
    soma += Number(cpf[i]) * (10 - i);
  }
  let d1 = (soma * 10) % 11;
  if (d1 === 10) d1 = 0;

  soma = 0;
  for (let i = 0; i < 10; i++){
    soma += Number(cpf[i]) * (11 - i);
  }
  let d2 = (soma * 10) % 11;
  if (d2 === 10) d2 = 0;

  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

async function calcular(salvar){
  try{
    const { rawNorms, compNorms } = await carregarNormas();
    const nome = (document.getElementById("nome")?.value || "").trim();
    const nasc = document.getElementById("dataNascimento")?.value;
    const apl  = document.getElementById("dataAplicacao")?.value;
    const cpf = (document.getElementById("cpf")?.value || "").trim();
    const sexo = document.getElementById("sexo")?.value || "";
    const escolaridade = document.getElementById("escolaridade")?.value || "";

    if(!nome || !nasc || !apl){ alert("Preencha Nome, Nascimento e Aplicação."); return; }

    const idade = calcularIdade(nasc, apl);
    if(!idade){ alert("Datas inválidas."); return; }
    if(!cpf || !sexo || !escolaridade){alert("Preencha CPF, sexo e escolaridade.");return;}
    if(!validarCPF(cpf)){alert("CPF inválido. Verifique e tente novamente.");return;}

    const faixa = faixaEtariaWAISIII(idade);
    if(!faixa){ alert("Faixa normativa não encontrada."); return; }

    const resultados = {};
    const pondByCode = {};

    for(const s of SUBTESTES){
      const v = document.getElementById(s.id)?.value;
      if(v === "" || v == null) continue;
      const bruto = Number(v);
      if(Number.isNaN(bruto) || bruto < 0){ alert(`Valor inválido em ${s.nome}`); return; }

      const pond = rawToScaledWAIS(rawNorms, faixa, s.codigo, bruto);
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

    // somatórios WAIS-III
const somas = {};
for (const [tipo, codigos] of Object.entries(WAIS_SCALES)) {
  somas[tipo] = somarEscala(pondByCode, codigos);
}
console.log("SOMAS WAIS:", somas);

    const compostos = {
  ICV: sumToCompositeWAIS(compNorms, "ICV", somas.ICV.soma),
  IOP: sumToCompositeWAIS(compNorms, "IOP", somas.IOP.soma),
  IMO: sumToCompositeWAIS(compNorms, "IMO", somas.IMO.soma),
  IVP: sumToCompositeWAIS(compNorms, "IVP", somas.IVP.soma),
  QI_VERBAL: sumToCompositeWAIS(compNorms, "QI_VERBAL", somas.QI_VERBAL.soma),
  QI_EXECUCAO: sumToCompositeWAIS(compNorms, "QI_EXECUCAO", somas.QI_EXECUCAO.soma),
  QI_TOTAL: sumToCompositeWAIS(compNorms, "QI_TOTAL", somas.QI_TOTAL.soma),
};

console.log("COMPOSTOS WAIS:", compostos);

    if(Object.keys(pondByCode).length === 0){ alert("Preencha ao menos um subteste."); return; }

const indicesInfo = {
  ICV: somas.ICV,
  IOP: somas.IOP,
  IMO: somas.IMO,
  IVP: somas.IVP,
};

const qiInfo = somas.QI_TOTAL; // mantém compatível com relatório atual

    montarRelatorio({ nome, cpf, sexo, escolaridade, nasc, apl, idade, faixa, resultados, indicesInfo, qiInfo, somas, compostos});

    if(salvar){
      const rel = document.getElementById("relatorio");
      // garante logo/imagens antes do canvas (especialmente no iOS)
await esperarImagensCarregarem(rel);
// pequeno delay para assegurar renderização dos gráficos/canvas
await new Promise(r => setTimeout(r, 150));

//await html2pdf().set({
// margin: [8, 8, 8, 8],
//  filename: `WISC-IV_${nome}.pdf`,
//  pagebreak: { mode: ["css", "legacy"], avoid: ".no-break" },
//  html2canvas: {
//    scale: 2,
//    useCORS: true,
//    allowTaint: false,
//    backgroundColor: "#ffffff",
//    imageTimeout: 15000
//  },
//  jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
//}).from(rel).save();

const laudos = getLaudos();
      laudos.unshift({
        nome,
        dataAplicacao: apl,
        faixa,
        createdAt: new Date().toISOString(),
        htmlRelatorio: rel.outerHTML
      });
      setLaudos(laudos);

      alert("Laudo salvo!");
    }

  }catch(e){
    console.error(e);
    alert("Erro ao calcular. Verifique os arquivos em /WAIS/data (waisiii_raw_to_scaled_br.json e waisiii_sum_to_composite_br.json).");
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
  //  if (opts && Array.isArray(opts.groupLabels) && scales?.x) {
    //  ctx.save();
//      //ctx.fillStyle = "rgba(13, 71, 161, 0.95)";
  //    ctx.font = "600 12px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial";
   //   ctx.textAlign = "center";
  //    const y = chartArea.top - 10;
  //    opts.groupLabels.forEach(g => {
  //      const x1 = scales.x.getPixelForValue(g.from);
   //     const x2 = scales.x.getPixelForValue(g.to);
  //      const xc = (x1 + x2) / 2;
  //      ctx.fillText(g.text, xc, y);
  //    });
  //    ctx.restore();
  //  }
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

  const { nome, cpf, sexo, escolaridade, nasc, apl, idade, faixa, resultados, indicesInfo, qiInfo, compostos } = data;
  const cpfTxt = formatarCPF(cpf);
  const sexoTxt = sexo;
  const escTxt = escolaridade;
  const matriz = renderMatrizConversao({ resultados, indicesInfo, qiInfo });
  const perfil = renderPerfilSubtestes(resultados);

  rel.style.display = "block";
  rel.innerHTML = `
    <div class="report">
      <div class="report-header">
        <img class="report-logo report-logo-top" src="/Equilibrium_Neuro/logo2.png" alt="Logo" onerror="this.style.display='none'">
        <div class="report-title">
          <div class="t1">Relatório – WAIS</div>
          <div class="t2">Conversão PB → Ponderado e somatórios por índice</div>
        </div>
        <div class="report-meta">
          <div class="badge">Faixa: ${faixa}</div>
          <div class="muted">Idade: ${idade.anos}a ${idade.meses}m</div>
        </div>
      </div>

      <div class="section">
        <div class="info-grid">
          <div><span class="k">Nome:</span> <span class="v">${nome}</span></div>
          <div><span class="k">CPF:</span> <span class="v">${cpfTxt || "—"}</span></div>
          <div><span class="k">Sexo:</span> <span class="v">${sexoTxt || "—"}</span></div>
          <div><span class="k">Escolaridade:</span> <span class="v">${escTxt || "—"}</span></div>
          <div><span class="k">Nascimento:</span> <span class="v">${nasc}</span></div>
          <div><span class="k">Aplicação:</span> <span class="v">${apl}</span></div>
        </div>
      </div>
      
<div class="duas-colunas">

  <!-- MATRIZ -->
  <div class="section no-break">
    <h3>Conversão PB → Ponderado e contribuição nos Índices</h3>
    <div class="matrix-card">${matriz}</div>
    <p class="muted" style="margin:10px 0 0;">
      Células azuis indicam subtestes usados na soma do índice/QIT. Suplementares podem aparecer entre parênteses.
    </p>
  </div>

    <!-- PERFIL (direita no seu exemplo, mas ordem visual é CSS) -->
  <div class="section no-break">
    <h3>Perfil dos Pontos Ponderados dos Subtestes</h3>
    <div class="perfil-card">
      ${perfil}
      <div class="canvas-wrap perfil-canvas">
        <canvas id="grafSub" height="560"></canvas>
      </div>
    </div>
    <p class="muted" style="margin:10px 0 0;">
      A faixa azul indica a região média aproximada (9–11) dos pontos ponderados.
    </p>
  </div>

</div>

    <div class="duas-colunas">

  <!-- SUBTESTES -->
  <div class="section no-break">
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

  <!-- INDICES -->
  <div class="section no-break">
    <h3>Índices e QIT (somatórios)</h3>

    <div class="canvas-wrap">
      <canvas id="grafIdx" height="300"></canvas>
    </div>

    <table class="table" style="margin-top:12px;">
  <thead>
    <tr>
      <th>Escala</th>
      <th>Ponto Composto</th>
      <th>Rank Percentil</th>
      <th>IC 90%</th>
      <th>IC 95%</th>
    </tr>
  </thead>
  <tbody>
    ${["ICV","IOP","IMO","IVP"].map(k=>{
      const info = indicesInfo[k];
      const comp = compostos?.[k];
      return `
        <tr>
          <td><b>${k}</b></td>
          <td>${comp?.composto ?? "—"}</td>
          <td>${comp?.percentil ?? "—"}</td>
          <td>${comp?.ic90 ?? "—"}</td>
          <td>${comp?.ic95 ?? "—"}</td>
        </tr>
      `;
    }).join("")}

    <tr>
      <td><b>QIT</b></td>
      <td>${compostos?.QIT?.composto ?? "—"}</td>
      <td>${compostos?.QIT?.percentil ?? "—"}</td>
      <td>${compostos?.QIT?.ic90 ?? "—"}</td>
      <td>${compostos?.QIT?.ic95 ?? "—"}</td>
        </tr>
      </tbody>
    </table>
  </div>

</div>

      <div class="report-footer">
        <div class="muted">Documento gerado automaticamente</div>

        <button class="btn-print no-print" onclick="imprimirRelatorio()">
            Imprimir (PDF)
        </button>

        <img class="report-logo report-logo-bottom" src="/Equilibrium_Neuro/logo2.png" alt="Logo" onerror="this.style.display='none'">
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
   // ordem + GAPs (retratro e mais legível)
const groups = [
  ["SM","VC","CO"],          // ICV core
  ["CB","CN","RM"],          // IOP core
  ["DG","SNL"],              // IMO core
  ["CD","PS"],               // IVP core
  ["IN","RP","CF","AR","CA"] // suplementares (no fim)
];

// cria posições com espaços entre grupos
let x = 1;
const xPos = {};   // codigo -> x
const tickAt = []; // x -> codigo (para callback)
groups.forEach((g, gi) => {
  g.forEach(code => {
    xPos[code] = x;
    tickAt[x] = code;
    x++;
  });
  if (gi < groups.length - 1) x += 1; // <-- GAP entre grupos
});

// monta pontos usando as posições com GAP
const points = Object.keys(xPos)
  .map(code => {
    const v = resultados?.[code]?.ponderado;
    return (v == null) ? null : { x: xPos[code], y: Number(v) };
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

        layout: { padding: { left: 6, right: 6, top: 18, bottom: 6 } },
        
        plugins:{
          legend:{ display:false },
          wiscScatterDecor:{
            band:{ min:9, max:11 },
            vlines: [4.5, 8.5, 11.5, 14.5],
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
            type: "linear",
              min: 0.5,
              max: x - 0.5,
                grid:{ display:false },
                  ticks: {
                    font: { size: 10 },
                    maxRotation: 0,
                     minRotation: 0,
                      padding: 6,
                        stepSize: 1,
                          autoSkip: false,
                            callback: (val) => {
                              const code = tickAt[Math.round(val)];
                                if (!code) return ""; // gaps ficam vazios
                          return ["CF","CA","IN","AR","RP"].includes(code) ? `(${code})` : code;
                  }
              }
          },

          y:{
            min:1, max:19,
              grid:{ color: "rgba(13,71,161,.10)" },
                ticks:{ stepSize:1,
                  font: { size: 10 },
            },
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
  layout: { padding: { left: 6, right: 6, top: 6, bottom: 6 } },
  plugins:{ legend:{ display:false } },
  scales:{
    x:{
      min:0.5, max:5.5,
      grid:{ display:false },
      ticks:{
        autoSkip:false,
        font:{ size: 10 },
        callback:(val)=>{
          const idx=Math.round(val)-1;
          return labels[idx] || "";
        }
      }
    },
    y:{
      // em vez de beginAtZero, fica clínico e legível
      suggestedMin: 0,
      suggestedMax: 60,
      ticks:{ font:{ size: 10 } },
      grid:{ color:"rgba(13,71,161,.10)" }
    }
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



// =========================
// PDF (html2pdf) — helpers
// =========================
async function esperarImagensCarregarem(container){
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = () => resolve();
      img.onerror = () => resolve(); // não trava o PDF
    });
  }));
}

async function baixarPDFSalvo(index){
  const laudos = getLaudos();
  const item = laudos[index];
  if(!item) return alert("Laudo não encontrado.");

  const temp = document.createElement("div");
  temp.innerHTML = item.htmlRelatorio;
  document.body.appendChild(temp);

  // garante logo/imagens antes do canvas (especialmente no iOS)
await esperarImagensCarregarem(temp);
// pequeno delay para assegurar renderização dos gráficos/canvas
await new Promise(r => setTimeout(r, 150));

//await html2pdf().set({
//  margin: [8, 8, 8, 8],
//  filename: `WISC-IV_${item.nome}.pdf`,
//  pagebreak: { mode: ["css", "legacy"], avoid: ".no-break" },
//  html2canvas: {
//    scale: 2,
//    useCORS: true,
//    allowTaint: false,
//    backgroundColor: "#ffffff",
//    imageTimeout: 15000
//  },
//  jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
//}).from(temp).save();

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

async function imprimirRelatorio(){
  const rel = document.getElementById("relatorio");
  if(!rel) return;

  // garante imagens e gráficos antes de imprimir
  await esperarImagensCarregarem(rel);
  await new Promise(r => setTimeout(r, 250));

  window.print();
}
