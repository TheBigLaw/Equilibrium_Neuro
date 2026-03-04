/**
 * TROQUE SOMENTE ISSO EM CADA PASTA
 */
const FORM_KEY = "pre_escolar";
// Exemplos:
// "pre_escolar"
// "idade_escolar_feminino"
// "idade_escolar_masculino"
// "adulto_autorrelato"
// "adulto_heterorrelato"

let SRS2_RULES = null;

const $ = (sel) => document.querySelector(sel);

function setSubtitle(msg){
  $("#subtitle").textContent = msg;
}

async function carregarRegras(){
  // Esta página está em /SRS2/<pasta>/index.html
  // então o JSON fica em /SRS2/data/srs2_rules.json -> "../data/srs2_rules.json"
  const res = await fetch("../data/srs2_rules.json", { cache: "no-store" });
  if(!res.ok){
    throw new Error("Não foi possível carregar ../data/srs2_rules.json");
  }
  SRS2_RULES = await res.json();
}

function getForm(){
  if(!SRS2_RULES) return null;
  return (SRS2_RULES.forms || []).find(f => f.form === FORM_KEY) || null;
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function renderItens(){
  const form = getForm();
  const container = $("#itens");
  container.innerHTML = "";

  if(!form){
    container.innerHTML = `<div class="small">FORM_KEY inválida: <b>${escapeHtml(FORM_KEY)}</b></div>`;
    return;
  }

  $("#pillForm").textContent = form.label || FORM_KEY;
  $("#hintForm").textContent = `Itens: ${form.items.length} • Escalas: ${form.scales.length}`;

  const labels = form.answer_labels || {
    1: "Nunca",
    2: "Às vezes",
    3: "Frequentemente",
    4: "Quase sempre"
  };

  for(const item of form.items){
    const div = document.createElement("div");
    div.className = "item";

    const reverseTag = item.reverse
      ? `<span class="tag">reverso</span>`
      : `<span class="tag">normal</span>`;

    div.innerHTML = `
      <div class="top">
        <div class="qid">${escapeHtml(item.id)}</div>
        <div class="txt">${escapeHtml(item.text)}</div>
        ${reverseTag}
      </div>

      <div class="opts">
        ${[1,2,3,4].map(v => `
          <label class="opt">
            <input type="radio" name="i${escapeHtml(item.id)}" value="${v}" />
            <span>${v} — ${escapeHtml(labels[v] || "")}</span>
          </label>
        `).join("")}
      </div>
    `;

    div.addEventListener("change", () => {
      atualizarContagemRespondidos();
    });

    container.appendChild(div);
  }
}

function atualizarContagemRespondidos(){
  const form = getForm();
  if(!form) return;

  let answered = 0;
  for(const item of form.items){
    const resp = document.querySelector(`input[name="i${CSS.escape(String(item.id))}"]:checked`);
    if(resp) answered++;
  }
  $("#pillAnswered").textContent = String(answered);
}

// Excel: normal -> resp-1 ; reverso -> 4-resp
function pontosItem(item, resp14){
  const r = parseInt(resp14, 10);
  if(Number.isNaN(r)) return null;
  return item.reverse ? (4 - r) : (r - 1);
}

function coletarRespostas(){
  const form = getForm();
  const map = {};
  let missing = 0;

  for(const item of form.items){
    const sel = `input[name="i${CSS.escape(String(item.id))}"]:checked`;
    const el = document.querySelector(sel);
    if(!el){
      missing++;
      continue;
    }
    map[item.id] = parseInt(el.value, 10);
  }

  return { respostas: map, missing };
}

function calcularBrutos(respostasMap){
  const form = getForm();

  const brutos = {};
  for(const scale of form.scales){
    brutos[scale.key] = 0;
  }

  for(const item of form.items){
    const resp = respostasMap[item.id];
    if(resp == null) continue;

    const pts = pontosItem(item, resp);
    if(pts == null) continue;

    for(const sKey of item.scales){
      brutos[sKey] += pts;
    }
  }

  return brutos;
}

function calcularTscores(brutos){
  const form = getForm();
  const ts = {};

  for(const scale of form.scales){
    const bruto = brutos[scale.key];
    const norms = form.norms?.[scale.key] || null;

    if(!norms){
      ts[scale.key] = null;
      continue;
    }

    const t = norms[String(bruto)];
    ts[scale.key] = (t == null) ? null : Number(t);
  }

  return ts;
}

function classificarT(t){
  if(t == null || Number.isNaN(t)) return "—";
  if(t <= 59) return "Normal";
  if(t <= 65) return "Leve";
  if(t <= 75) return "Moderado";
  return "Severo";
}

function renderTabelaResultados(brutos, tscores){
  const form = getForm();
  const tbody = $("#tblResultados tbody");
  tbody.innerHTML = "";

  for(const scale of form.scales){
    const bruto = brutos[scale.key];
    const t = tscores[scale.key];
    const cls = classificarT(t);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="font-weight:800;color:#e5e7eb">${escapeHtml(scale.label || scale.key)}</div>
        <div class="small">${escapeHtml(scale.key)}</div>
      </td>
      <td class="right nowrap">${bruto ?? "—"}</td>
      <td class="right nowrap">${t ?? "—"}</td>
      <td class="nowrap">${escapeHtml(cls)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderTabelaItens(respostasMap){
  const form = getForm();
  const tbody = $("#tblItens tbody");
  tbody.innerHTML = "";

  for(const item of form.items){
    const resp = respostasMap[item.id];
    const pts = (resp == null) ? null : pontosItem(item, resp);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="nowrap">${escapeHtml(item.id)}</td>
      <td class="nowrap">${resp ?? "—"}</td>
      <td class="right nowrap">${pts ?? "—"}</td>
      <td class="nowrap">${item.reverse ? "sim" : "não"}</td>
    `;
    tbody.appendChild(tr);
  }
}

function calcularEExibir(){
  const form = getForm();
  if(!form) return;

  const { respostas, missing } = coletarRespostas();
  const brutos = calcularBrutos(respostas);
  const tscores = calcularTscores(brutos);

  renderTabelaResultados(brutos, tscores);
  //renderTabelaItens(respostas);

  const total = form.items.length;
  const answered = total - missing;
  $("#summaryLine").textContent = `Respondidos: ${answered}/${total} • Faltando: ${missing}`;

  return { respostas, brutos, tscores, missing };
}

function limparTudo(){
  const form = getForm();
  if(!form) return;

  for(const item of form.items){
    const els = document.querySelectorAll(`input[name="i${CSS.escape(String(item.id))}"]`);
    els.forEach(el => el.checked = false);
  }

  atualizarContagemRespondidos();
  $("#tblResultados tbody").innerHTML = "";
  $("#tblItens tbody").innerHTML = "";
  $("#summaryLine").textContent = "Preencha os itens e clique em “Recalcular”.";
}

document.addEventListener("DOMContentLoaded", async () => {
  try{
    setSubtitle("Carregando regras…");
    await carregarRegras();

    const form = getForm();
    if(!form){
      setSubtitle(`ERRO: FORM_KEY inválida (${FORM_KEY})`);
    }else{
      setSubtitle(form.label || FORM_KEY);
    }

    // default data = hoje
    const today = new Date();
    $("#data").value = today.toISOString().slice(0,10);

    renderItens();
    atualizarContagemRespondidos();

    $("#btnRecalc").addEventListener("click", () => {
      calcularEExibir();
    });

    $("#btnClear").addEventListener("click", () => {
     // limparTudo();
    });
    instalarPrintComRelatorio();

  }catch(err){
    console.error(err);
    setSubtitle("Falha ao carregar regras.");

    const container = $("#itens");
    container.innerHTML = `
      <div class="small" style="color:#fca5a5">
        Erro: ${escapeHtml(err.message || String(err))}
        <br><br>
        Confira se o arquivo existe em: <b>../data/srs2_rules.json</b>
      </div>
    `;
  }
});

// ------------------------------
// RELATÓRIO (PRINT) – GERAÇÃO
// ------------------------------

// Ordem “igual ao PDF” (por label). Ajusta sozinho mesmo se keys mudarem.
const SCALE_ORDER_HINTS = [
  "Percepção Social",
  "Cognição Social",
  "Comunicação Social",
  "Motivação Social",
  "Padrões Restritos",
  "Comunicação e Interação Social",
  "Escore Total"
];

// Textos descritivos (paráfrase clínica; você pode refinar depois)
const SCALE_DESCRIPTIONS = {
  "Percepção Social":
    "Avalia a capacidade de reconhecer pistas sociais e compreender aspectos da percepção do comportamento social recíproco.",
  "Cognição Social":
    "Refere-se à interpretação de sinais e pistas sociais, incluindo o entendimento do significado social das situações e interações.",
  "Comunicação Social":
    "Relaciona-se à comunicação expressiva e às habilidades usadas para compartilhar informações e manter a reciprocidade social.",
  "Motivação Social":
    "Refere-se ao interesse e ao engajamento em interações sociais, incluindo iniciativa social, orientação empática e inibição/ansiedade social.",
  "Padrões Restritos e Repetitivos":
    "Indica a presença de comportamentos restritos, repetitivos e interesses/rotinas inflexíveis que podem impactar o funcionamento social.",
  "Comunicação e Interação Social":
    "Medida global de comunicação e reciprocidade social, integrando sinais sociais, expressão, manutenção e compreensão de relacionamentos.",
  "Escore Total":
    "Síntese geral do perfil de responsividade social com base no conjunto de escalas, auxiliando a compreensão do nível de comprometimento."
};

function normalizeStr(s){
  return String(s || "").trim().toLowerCase();
}

function sortScalesLikePdf(scales){
  const scored = scales.map(sc => {
    const lbl = sc.label || sc.key;
    const idx = SCALE_ORDER_HINTS.findIndex(h => normalizeStr(lbl).includes(normalizeStr(h)));
    return { sc, idx: (idx === -1 ? 999 : idx) };
  });
  scored.sort((a,b) => a.idx - b.idx);
  return scored.map(x => x.sc);
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function countMissingByScale(form){
  // missing por escala = itens sem resposta que pertencem àquela escala
  const missingByScale = {};
  for(const sc of form.scales) missingByScale[sc.key] = 0;

  for(const item of form.items){
    const sel = document.querySelector(`input[name="i${CSS.escape(String(item.id))}"]:checked`);
    const answered = !!sel;
    if(answered) continue;

    for(const sKey of item.scales){
      if(missingByScale[sKey] != null) missingByScale[sKey] += 1;
    }
  }
  return missingByScale;
}

// --- SVG: Perfil (linha com pontos) ---
function svgProfileChart(rows){
  // rows: [{label, bruto, t}]
  const W = 920, H = 360;
  const left = 80, right = 220, top = 40, bottom = 40;
  const plotW = W - left - right;
  const plotH = H - top - bottom;

  const tMin = 20, tMax = 80;

  function xOfT(t){
    const tt = clamp(Number(t), tMin, tMax);
    return left + ((tt - tMin) / (tMax - tMin)) * plotW;
  }

  const yStep = plotH / Math.max(1, rows.length);
  function yOfI(i){
    return top + (i + 0.5) * yStep;
  }

  // fundo em faixas (como o PDF, aproximado)
  const bands = [
    {a:20, b:40, fill:"#e9e9e9"},
    {a:40, b:60, fill:"#dcdcdc"},
    {a:60, b:80, fill:"#cfcfcf"},
  ];

  let svg = `
  <svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
  `;

  // bands
  for(const band of bands){
    const x1 = xOfT(band.a);
    const x2 = xOfT(band.b);
    svg += `<rect x="${x1}" y="${top}" width="${x2-x1}" height="${plotH}" fill="${band.fill}" opacity="0.85"/>`;
  }

  // grade vertical (ticks)
  for(let t=20; t<=80; t+=5){
    const x = xOfT(t);
    const isMajor = (t % 10 === 0);
    svg += `<line x1="${x}" y1="${top}" x2="${x}" y2="${top+plotH}" stroke="#fff" stroke-width="${isMajor?2:1}" opacity="${isMajor?0.9:0.7}"/>`;
    if(isMajor){
      svg += `<text x="${x}" y="${top-10}" text-anchor="middle" font-size="12" fill="#111">${t}</text>`;
    }
  }

  // labels à direita e colunas brutas/norma à esquerda
  svg += `<text x="${12}" y="${top-10}" font-size="12" fill="#111" font-weight="700">Dados brutos</text>`;
  svg += `<text x="${12}" y="${top+14}" font-size="12" fill="#111" font-weight="700">Normas</text>`;

  // pontos + linha
  let path = "";
  rows.forEach((r,i) => {
    const x = xOfT(r.t ?? 50);
    const y = yOfI(i);
    path += (i===0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
  });
  svg += `<path d="${path}" fill="none" stroke="#111" stroke-width="2"/>`;

  rows.forEach((r,i) => {
    const y = yOfI(i);
    const x = xOfT(r.t ?? 50);

    // números brutos/norma (aproximação)
    svg += `<text x="${20}" y="${y+4}" font-size="12" fill="#111">${r.bruto ?? "—"}</text>`;
    svg += `<text x="${52}" y="${y+4}" font-size="12" fill="#111">${r.t ?? "—"}</text>`;

    // dot vermelho
    svg += `<circle cx="${x}" cy="${y}" r="7" fill="#e11d48"/>`;

    // label direita
    svg += `<text x="${W-right+10}" y="${y+4}" font-size="12" fill="#111">${escapeHtml(r.label)}</text>`;
  });

  // bordas da área de plot
  svg += `<rect x="${left}" y="${top}" width="${plotW}" height="${plotH}" fill="none" stroke="#bbb" />`;

  svg += `</svg>`;
  return svg;
}

// --- SVG: Curva com marcador T ---
function svgBell(t){
  const W=520, H=150;
  const tMin=20, tMax=80;
  const xPad=20, yPad=20;

  const plotW = W - xPad*2;
  const baseY = H - 30;

  function xOfT(val){
    const tt = clamp(Number(val), tMin, tMax);
    return xPad + ((tt - tMin)/(tMax - tMin))*plotW;
  }

  // curva “fake” (visual), não estatística real — só estética/posicionamento
  const pts = [];
  for(let i=0;i<=80;i++){
    const u = i/80;
    const x = xPad + u*plotW;
    // sino aproximado
    const y = baseY - Math.exp(-Math.pow((u-0.5)/0.18,2)) * 70;
    pts.push([x,y]);
  }
  const d = pts.map((p,i)=> (i===0?`M ${p[0]} ${p[1]}`:`L ${p[0]} ${p[1]}`)).join(" ");

  const xt = xOfT(t ?? 50);

  return `
  <svg class="rep-bell" viewBox="0 0 ${W} ${H}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
    <path d="${d}" fill="rgba(186,230,253,.35)" stroke="rgba(0,0,0,.10)" stroke-width="2"/>
    <line x1="${xt}" y1="${baseY-78}" x2="${xt}" y2="${baseY}" stroke="#e11d48" stroke-width="3"/>
    <circle cx="${xt}" cy="${baseY-78}" r="6" fill="#e11d48"/>

    <!-- eixo -->
    <line x1="${xPad}" y1="${baseY}" x2="${xPad+plotW}" y2="${baseY}" stroke="#111" stroke-width="2"/>

    ${[20,30,40,50,60,70,80].map(v => `
      <line x1="${xOfT(v)}" y1="${baseY}" x2="${xOfT(v)}" y2="${baseY+6}" stroke="#111" stroke-width="2"/>
      <text x="${xOfT(v)}" y="${baseY+22}" text-anchor="middle" font-size="12" fill="#111">${v}</text>
    `).join("")}
  </svg>`;
}

function buildInterpretationText(){
  return `
    <p><b>Escore-T 59 e abaixo — Dentro dos limites usuais</b><br>
    Valores nesta faixa tendem a indicar responsividade social dentro do esperado, considerando o grupo normativo.</p>

    <p><b>Escore-T 60 a 65 — Nível leve</b><br>
    Sugere dificuldades leves em aspectos da reciprocidade social, que podem interferir em algumas situações do cotidiano.</p>

    <p><b>Escore-T 66 a 75 — Nível moderado</b><br>
    Indica prejuízos moderados com maior probabilidade de impacto funcional em interações sociais, comunicação e flexibilidade comportamental.</p>

    <p><b>Escore-T 76 e acima — Nível severo</b><br>
    Indica comprometimento severo, com alta probabilidade de impacto importante e persistente no funcionamento social.</p>
  `.trim();
}

function preencherRelatorioSRS2(result){
  const form = getForm();
  if(!form) return;

  const scalesSorted = sortScalesLikePdf(form.scales);

  // header
  document.getElementById("repSubTitle").textContent = (form.label || FORM_KEY);
  document.getElementById("repTableSub").textContent = (form.label || FORM_KEY);

  document.getElementById("repPaciente").textContent = document.getElementById("paciente").value || "—";
  document.getElementById("repData").textContent = document.getElementById("data").value || "—";
  document.getElementById("repAvaliador").textContent = document.getElementById("avaliador").value || "—";

  // missing por escala
  const missingByScale = countMissingByScale(form);

  // montar rows
  const rows = scalesSorted.map(sc => ({
    key: sc.key,
    label: sc.label || sc.key,
    bruto: result.brutos?.[sc.key],
    t: result.tscores?.[sc.key]
  }));

  // 1) Perfil
  document.getElementById("repProfileChart").innerHTML = svgProfileChart(rows);

  // 2) Tabela de escores
  const tbody = document.querySelector("#repScoreTable tbody");
  tbody.innerHTML = "";
  for(const r of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.label)}</td>
      <td class="right">${r.bruto ?? "—"}</td>
      <td class="right">${r.t ?? "—"}</td>
    `;
    tbody.appendChild(tr);
  }

  // 3) Seções por escala
  const container = document.getElementById("repScaleSections");
  container.innerHTML = "";

  for(const r of rows){
    const t = (r.t == null ? null : Number(r.t));
    const ciA = (t == null ? "—" : clamp(t - 3, 20, 80));
    const ciB = (t == null ? "—" : clamp(t + 3, 20, 80));
    const missing = missingByScale[r.key] ?? 0;

    // texto
    const descKey = SCALE_ORDER_HINTS.find(h => normalizeStr(r.label).includes(normalizeStr(h))) || r.label;
    const desc = SCALE_DESCRIPTIONS[descKey] || "Descrição clínica da escala.";

    const sec = document.createElement("section");
    sec.className = "rep-scale";

    sec.innerHTML = `
      <h3>${escapeHtml(r.label)}</h3>
      <div class="rep-hint">Heterorrelato Adulto • Escore T (50+10z)</div>

      <div class="rep-scale-grid">
        <div>
          <table class="rep-mini-table">
            <tbody>
              <tr><td>Pontuação bruta</td><td>${r.bruto ?? "—"}</td></tr>
              <tr><td>Valor da norma</td><td>${r.t ?? "—"}</td></tr>
              <tr><td>Respostas faltantes (missing)</td><td>${missing}</td></tr>
              <tr><td>Intervalo de confiança</td><td>[${ciA} - ${ciB}]</td></tr>
            </tbody>
          </table>
        </div>

        <div>
          ${svgBell(t)}
        </div>
      </div>

      <div class="rep-scale-desc">${escapeHtml(desc)}</div>
    `;

    container.appendChild(sec);
  }

  // 4) Interpretação
  document.getElementById("repInterpretation").innerHTML = buildInterpretationText();
}

// IMPORTANTE: garantir que o botão Print preencha o relatório antes
// Troque seu handler atual do btnPrint por este:
function instalarPrintComRelatorio(){
  const btn = document.getElementById("btnPrint");
  if(!btn) return;

  btn.addEventListener("click", () => {
    const result = calcularEExibir();
    if(result){
      preencherRelatorioSRS2(result);
    }
    window.print();
  });
}
