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

// -----------------------
// Variáveis globais (evita 'not defined' quando recarrega / redesenha)
// -----------------------
let chartSub = null;
let chartIdx = null;

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

// -----------------------
// Helpers do relatório
// -----------------------
function formatarDataISO(iso){
  if(!iso) return "";
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return String(iso);
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const aa = d.getFullYear();
  return `${dd}/${mm}/${aa}`;
}

/**
 * Plugin decorativo do gráfico de subtestes:
 * - faixa média (9–11) no eixo Y
 * - linhas verticais separando domínios
 * - rótulos de domínio abaixo do eixo X
 *
 * IMPORTANTE: vlines devem ser passadas como posições reais (ex: 5.5)
 */
function registrarPluginsChart(){
  if (window.__WISC_CHART_PLUGINS__) return;
  window.__WISC_CHART_PLUGINS__ = true;

  if (typeof Chart === "undefined") return;

  const plugin = {
    id: "wiscScatterDecor",
    beforeDraw(chart, args, opts){
      try{
        const o = (opts || {});
        const { ctx, chartArea, scales } = chart;
        if(!chartArea || !scales?.x || !scales?.y) return;

        const x = scales.x;
        const y = scales.y;

        ctx.save();

        // Faixa média (band)
        if(o.band && typeof o.band.min === "number" && typeof o.band.max === "number"){
          const yTop = y.getPixelForValue(o.band.max);
          const yBot = y.getPixelForValue(o.band.min);
          ctx.fillStyle = "rgba(30,136,229,0.10)";
          ctx.fillRect(chartArea.left, yTop, chartArea.right - chartArea.left, yBot - yTop);
        }

        // Linhas verticais (separação de domínios)
        if(Array.isArray(o.vlines)){
          ctx.strokeStyle = "rgba(13,71,161,0.22)";
          ctx.lineWidth = 1;
          o.vlines.forEach(v=>{
            const px = x.getPixelForValue(v); // v já é o "meio" (ex: 5.5)
            ctx.beginPath();
            ctx.moveTo(px, chartArea.top);
            ctx.lineTo(px, chartArea.bottom);
            ctx.stroke();
          });
        }

        // Labels dos grupos (domínios) na base
        if(Array.isArray(o.groupLabels)){
          const baseY = chartArea.bottom + 16;
          ctx.fillStyle = "rgba(13,71,161,0.88)";
          ctx.font = "600 10px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          o.groupLabels.forEach(g=>{
            const fromPx = x.getPixelForValue(g.from);
            const toPx = x.getPixelForValue(g.to);
            const mid = (fromPx + toPx) / 2;
            ctx.fillText(String(g.text || ""), mid, baseY);
          });
        }

        ctx.restore();
      }catch(_e){}
    }
  };

  Chart.register(plugin);
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
      await new Promise(r => setTimeout(r, 200));

      await html2pdf().set({
        margin: [8, 8, 8, 8],
        filename: `WISC-IV_${nome}.pdf`,
        pagebreak: {
          mode: ["avoid-all", "css", "legacy"],
          avoid: [".no-break", ".report-block", "canvas", ".canvas-wrap", ".matrix-card"]
        },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          imageTimeout: 20000
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
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
    alert("Erro ao calcular. Verifique normas-wisciv.json em /tests/wisciv/data/.");
  }
}

function renderPerfilSubtestes(resultados){
  const grupos = [
    { titulo: "Compreensão Verbal", codes: ["SM","VC","CO","IN","RP"] },   // 5
    { titulo: "Organização Perceptual", codes: ["CB","CN","RM","CF"] },   // 4
    { titulo: "Memória Operacional", codes: ["DG","SNL","AR"] },          // 3
    { titulo: "Velocidade de Proc.", codes: ["CD","PS","CA"] },          // 3
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

// -----------------------
// RELATÓRIO (HTML)
// -----------------------
function montarRelatorio(data) {
  const rel = document.getElementById("relatorio");
  if (!rel) return;

  registrarPluginsChart();

  const { nome, nasc, apl, idade, faixa, resultados, indicesInfo, qiInfo } = data;
  const matriz = renderMatrizConversao({ resultados, indicesInfo, qiInfo });
  const perfil = renderPerfilSubtestes(resultados);

  const logoTop = `
    <img class="report-logo report-logo-top"
      src="logo.png"
      crossorigin="anonymous"
      alt="Logo"
      onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='logo2.png';}else{this.style.display='none';}">
  `;

  const logoBottom = `
    <img class="report-logo report-logo-bottom"
      src="logo.png"
      crossorigin="anonymous"
      alt="Logo"
      onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='logo2.png';}else{this.style.display='none';}">
  `;

  rel.style.display = "block";
  rel.innerHTML = `
    <div class="report">
      <div class="report-header no-break">
        <div class="report-brand">
          ${logoTop}
          <div class="report-title">
            <div class="t1">Relatório – WISC-IV</div>
            <div class="t2">Conversão PB → Ponderado • Perfil de Subtestes • Somatórios</div>
          </div>
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

      <!-- BLOCO 1: Perfil (esquerda) + Índices/QIT (direita) -->
      <div class="two-col report-block no-break">
        <div class="section">
          <h3>Perfil dos Pontos Ponderados dos Subtestes</h3>
          <div class="perfil-card">
            ${perfil}
            <div class="canvas-wrap perfil-canvas">
              <canvas id="grafSub" height="180"></canvas>
            </div>
          </div>
          <p class="muted hint">Ponderados (1–19). Faixa azul: 9–11. Separação por domínios.</p>
        </div>

        <div class="section">
          <h3>Índices e QIT (somatórios)</h3>
          <div class="canvas-wrap idx-canvas">
            <canvas id="grafIdx" height="140"></canvas>
          </div>

          <table class="table table-compact" style="margin-top:10px;">
            <thead><tr><th>Medida</th><th>Soma</th><th>Subtestes usados</th></tr></thead>
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
      </div>

      <!-- BLOCO 2: Matriz (esquerda) + Detalhamento (direita) -->
      <div class="two-col report-block">
        <div class="section">
          <h3>Conversão PB → Ponderado e contribuição nos Índices</h3>
          <div class="matrix-card">${matriz}</div>
          <p class="muted hint">Células preenchidas = usadas na soma. Suplementares com (código).</p>
        </div>

        <div class="section">
          <h3>Subtestes (detalhamento)</h3>
          <table class="table table-compact">
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
      </div>

      <div class="report-footer no-break">
        <div class="muted">Documento gerado automaticamente</div>
        ${logoBottom}
      </div>
    </div>
  `;

  desenharGraficos(resultados, indicesInfo, qiInfo);
}

// -----------------------
// GRÁFICOS (Chart.js)
// -----------------------
function desenharGraficos(resultados, indicesInfo, qiInfo){
  registrarPluginsChart();

  // ---------- Subtestes: SCATTER (pontos) ----------
  const canvasSub = document.getElementById("grafSub");
  if(canvasSub){
    if(chartSub) chartSub.destroy();

    // Ordem do perfil (por domínio) — precisa bater com as separações
    const labels = ["SM","VC","CO","IN","RP","CB","CN","RM","CF","DG","SNL","AR","CD","PS","CA"];

    const points = labels
      .map((c, i) => {
        const v = resultados?.[c]?.ponderado;
        return (v == null) ? null : { x: i+1, y: Number(v) };
      })
      .filter(Boolean);

    // separadores corretos: após 5 (CV) => 5.5 | após 9 (OP) => 9.5 | após 12 (MO) => 12.5
    chartSub = new Chart(canvasSub, {
      type:"scatter",
      data:{
        datasets:[{
          data: points,
          pointRadius: 4.2,
          pointHoverRadius: 5.0,
          borderWidth: 0,
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{
          legend:{ display:false },
          wiscScatterDecor:{
            band:{ min:9, max:11 },
            vlines:[5.5, 9.5, 12.5],
            groupLabels:[
              { from:1,  to:5,  text:"Compreensão Verbal" },
              { from:6,  to:9,  text:"Organização Perceptual" },
              { from:10, to:12, text:"Memória Operacional" },
              { from:13, to:15, text:"Velocidade de Processamento" },
            ]
          }
        },
        layout:{ padding:{ bottom: 18 } },
        scales:{
          x:{
            min:0.5, max:15.5,
            grid:{ display:false },
            ticks:{
              autoSkip:false,
              maxRotation:0,
              minRotation:0,
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
  const canvasIdx = document.getElementById("grafIdx");
  if(canvasIdx){
    if(chartIdx) chartIdx.destroy();

    const labels = ["ICV","IOP","IMO","IVP","QIT"];
    const vals = [
      indicesInfo?.ICV?.soma ?? null,
      indicesInfo?.IOP?.soma ?? null,
      indicesInfo?.IMO?.soma ?? null,
      indicesInfo?.IVP?.soma ?? null,
      qiInfo?.soma ?? null,
    ];
    const pts = vals
      .map((v,i)=> v==null ? null : ({x:i+1, y:Number(v)}))
      .filter(Boolean);

    const maxY = Math.max(10, ...vals.filter(v=>v!=null).map(Number));
    const suggestedMax = Math.ceil(maxY / 5) * 5;

    chartIdx = new Chart(canvasIdx, {
      type:"scatter",
      data:{ datasets:[{ data: pts, pointRadius:4.2, pointHoverRadius:5.0, borderWidth:0 }] },
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
          y:{
            beginAtZero:true,
            suggestedMax,
            ticks:{ stepSize:5 }
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
      img.onerror = () => resolve();
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

  await esperarImagensCarregarem(temp);
  await new Promise(r => setTimeout(r, 200));

  await html2pdf().set({
    margin: [8, 8, 8, 8],
    filename: `WISC-IV_${item.nome}.pdf`,
    pagebreak: {
      mode: ["avoid-all", "css", "legacy"],
      avoid: [".no-break", ".report-block", "canvas", ".canvas-wrap", ".matrix-card"]
    },
    html2canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      imageTimeout: 20000
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  }).from(temp).save();

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
