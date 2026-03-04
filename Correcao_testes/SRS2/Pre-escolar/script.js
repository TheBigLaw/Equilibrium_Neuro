/**
 * TROQUE SOMENTE ISSO EM CADA PASTA
 */
const FORM_KEY = "Pre-escolar";
// Exemplos:
// "pre_escolar"
// "idade_escolar_feminino"
// "idade_escolar_masculino"
// "adulto_autorrelato"
// "adulto_heterorrelato"

fetch("../data/srs2_rules.json")

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
  renderTabelaItens(respostas);

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

    $("#btnPrint").addEventListener("click", () => {
      calcularEExibir();
      window.print();
    });

    $("#btnClear").addEventListener("click", () => {
      limparTudo();
    });

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
