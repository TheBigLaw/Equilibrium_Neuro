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

const SUBTESTES = [
  { codigo:"CB", nome:"Cubos", dominio:"IOP", essencial:true },
  { codigo:"SM", nome:"Semelhanças", dominio:"ICV", essencial:true },
  { codigo:"DG", nome:"Dígitos", dominio:"IMO", essencial:true },
  { codigo:"CN", nome:"Conceitos Figurativos", dominio:"IOP", essencial:true },
  { codigo:"CD", nome:"Código", dominio:"IVP", essencial:true },
  { codigo:"VC", nome:"Vocabulário", dominio:"ICV", essencial:true },
  { codigo:"SNL", nome:"Seq. de Núm. e Letras", dominio:"IMO", essencial:true },
  { codigo:"RM", nome:"Raciocínio Matricial", dominio:"IOP", essencial:true },
  { codigo:"CO", nome:"Compreensão", dominio:"ICV", essencial:true },
  { codigo:"PS", nome:"Procurar Símbolos", dominio:"IVP", essencial:true },
  { codigo:"CF", nome:"Completar Figuras", dominio:"IOP", essencial:false },
  { codigo:"CA", nome:"Cancelamento", dominio:"IVP", essencial:false },
  { codigo:"IN", nome:"Informação", dominio:"ICV", essencial:false },
  { codigo:"AR", nome:"Aritmética", dominio:"IMO", essencial:false },
  { codigo:"RP", nome:"Raciocínio com Palavras", dominio:"ICV", essencial:false },
];

const INDICES = {
  ICV: { core:["SM","VC","CO"], supl:["IN","RP"], label:"Compreensão Verbal" },
  IOP: { core:["CB","CN","RM"], supl:["CF"], label:"Organização Perceptual" },
  IMO: { core:["DG","SNL"], supl:["AR"], label:"Memória Operacional" },
  IVP: { core:["CD","PS"], supl:["CA"], label:"Velocidade de Processamento" },
};

const QIT_CORE = ["SM","VC","CO","CB","CN","RM","DG","SNL","CD","PS"];

function formatarDataISO(d){
  if(!d) return "";
  if(typeof d === "string"){
    if(d.includes("/")) return d;
    const [y,m,dd] = d.split("-");
    if(y && m && dd) return `${dd}/${m}/${y}`;
    return d;
  }
  try{
    return new Date(d).toLocaleDateString("pt-BR");
  }catch(e){
    return String(d);
  }
}

function diffIdade(nascISO, aplISO){
  const nasc = new Date(nascISO);
  const apl  = new Date(aplISO);
  let anos = apl.getFullYear() - nasc.getFullYear();
  let meses = apl.getMonth() - nasc.getMonth();
  let dias = apl.getDate() - nasc.getDate();
  if(dias < 0){
    meses -= 1;
    const prev = new Date(apl.getFullYear(), apl.getMonth(), 0).getDate();
    dias += prev;
  }
  if(meses < 0){
    anos -= 1;
    meses += 12;
  }
  if(anos < 0) anos = 0;
  return { anos, meses, dias };
}

function faixaEtaria(idade){
  const totalMeses = idade.anos*12 + idade.meses;
  const a = idade.anos;
  const m = idade.meses;
  const start = `${a}:${m.toString().padStart(2,"0")}`;
  const endMeses = totalMeses + 3;
  const ea = Math.floor(endMeses/12);
  const em = endMeses%12;
  const end = `${ea}:${em.toString().padStart(2,"0")}`;
  return `${start}-${end}`;
}

function classificarPP(pp){
  if(pp <= 4) return "muito inferior";
  if(pp <= 6) return "inferior";
  if(pp <= 8) return "médio inferior";
  if(pp <= 11) return "médio";
  if(pp <= 13) return "médio superior";
  if(pp <= 15) return "superior";
  return "muito superior";
}

function getLaudos(){
  try{
    return JSON.parse(localStorage.getItem(LAUDOS_KEY) || "[]");
  }catch(e){
    return [];
  }
}

function setLaudos(arr){
  localStorage.setItem(LAUDOS_KEY, JSON.stringify(arr));
}

function adicionarLaudo(laudo){
  const laudos = getLaudos();
  laudos.unshift(laudo);
  setLaudos(laudos);
}

function lerPBsDoFormulario(){
  const out = {};
  for(const st of SUBTESTES){
    const el = document.getElementById("pb_"+st.codigo);
    if(!el) continue;
    const v = el.value.trim();
    out[st.codigo] = v === "" ? null : Number(v);
  }
  return out;
}

function calcularPonderado(normas, faixa, subCodigo, pb){
  if(pb == null || pb === "" || Number.isNaN(pb)) return null;
  const byFaixa = normas[faixa];
  if(!byFaixa) return null;
  const mapa = byFaixa[subCodigo];
  if(!mapa) return null;
  const key = String(pb);
  if(mapa[key] == null) return null;
  return Number(mapa[key]);
}

function calcularIndices(resultados){
  const info = {};
  for(const [idx, def] of Object.entries(INDICES)){
    const usados = [];
    let soma = 0;

    const coreDisponiveis = def.core.filter(c => resultados[c]?.ponderado != null);
    if(coreDisponiveis.length === def.core.length){
      for(const c of def.core){
        usados.push(c);
        soma += resultados[c].ponderado;
      }
    }else{
      const faltantes = def.core.filter(c => resultados[c]?.ponderado == null);
      const presentes = def.core.filter(c => resultados[c]?.ponderado != null);
      for(const c of presentes){
        usados.push(c);
        soma += resultados[c].ponderado;
      }
      for(const supl of def.supl || []){
        if(faltantes.length === 0) break;
        if(resultados[supl]?.ponderado != null){
          usados.push(supl);
          soma += resultados[supl].ponderado;
          faltantes.pop();
        }
      }
    }

    info[idx] = { soma: usados.length ? soma : null, usados };
  }
  return info;
}

function calcularQIT(resultados){
  let soma = 0;
  const usados = [];
  for(const c of QIT_CORE){
    if(resultados[c]?.ponderado != null){
      soma += resultados[c].ponderado;
      usados.push(c);
    }else{
      return { soma:null, usados };
    }
  }
  return { soma, usados };
}

function renderPerfil(resultados){
  const doms = [
    { label:"Compreensão Verbal", cods:["SM","VC","CO","IN","RP"] },
    { label:"Organização Perceptual", cods:["CB","CN","RM","CF"] },
    { label:"Memória Operacional", cods:["DG","SNL","AR"] },
    { label:"Velocidade de Proc.", cods:["CD","PS","CA"] },
  ];

  const header1 = doms.map(d=>`<th colspan="${d.cods.length}">${d.label}</th>`).join("");
  const header2 = doms.map(d=>d.cods.map(c=>{
    const isSupl = ["CF","CA","IN","AR","RP"].includes(c);
    return `<th>${isSupl?`(${c})`:c}</th>`;
  }).join("")).join("");

  const rowVals = doms.map(d=>d.cods.map(c=>{
    const v = resultados[c]?.ponderado;
    const isSupl = ["CF","CA","IN","AR","RP"].includes(c);
    return `<td>${v==null?"—":(isSupl?`(${v})`:v)}</td>`;
  }).join("")).join("");

  return `
    <table class="perfil-table">
      <thead>
        <tr>${header1}</tr>
        <tr>${header2}</tr>
      </thead>
      <tbody>
        <tr>${rowVals}</tr>
      </tbody>
    </table>
  `;
}

function renderMatrizConversao({ resultados, indicesInfo, qiInfo }){
  const cols = ["ICV","IOP","IMO","IVP","QIT"];

  function celulaContrib(codigo, col){
    const usados = (col === "QIT") ? (qiInfo.usados||[]) : (indicesInfo[col]?.usados||[]);
    const isSupl = ["CF","CA","IN","AR","RP"].includes(codigo);
    const pp = resultados[codigo]?.ponderado;
    if(!usados.includes(codigo) || pp==null) return `<td class="muted">—</td>`;
    return `<td class="pill">${isSupl?`(${pp})`:pp}</td>`;
  }

  const rows = SUBTESTES.map(st=>{
    const r = resultados[st.codigo] || {};
    const isSupl = !st.essencial;
    return `
      <tr class="${isSupl?"supl":""}">
        <td><b>${st.nome}</b> <span class="muted">(${st.codigo})</span></td>
        <td>${r.bruto==null?"—":r.bruto}</td>
        <td>${r.ponderado==null?"—":r.ponderado}</td>
        ${cols.map(c=>celulaContrib(st.codigo, c)).join("")}
      </tr>
    `;
  }).join("");

  const somaIdx = (k)=> (k==="QIT" ? qiInfo.soma : indicesInfo[k]?.soma);

  return `
    <table class="wisc-matrix">
      <thead>
        <tr>
          <th rowspan="2">Subtestes</th>
          <th rowspan="2">PB</th>
          <th rowspan="2">Ponderado</th>
          <th colspan="5">Contribuição (Pontos Ponderados)</th>
        </tr>
        <tr>
          <th>ICV</th><th>IOP</th><th>IMO</th><th>IVP</th><th>QIT</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3"><b>Soma dos Pontos Ponderados</b></td>
          <td><b>${somaIdx("ICV") ?? "—"}</b></td>
          <td><b>${somaIdx("IOP") ?? "—"}</b></td>
          <td><b>${somaIdx("IMO") ?? "—"}</b></td>
          <td><b>${somaIdx("IVP") ?? "—"}</b></td>
          <td><b>${somaIdx("QIT") ?? "—"}</b></td>
        </tr>
      </tfoot>
    </table>
  `;
}

async function calcular(salvar=false){
  const nome = (document.getElementById("nome")?.value || "").trim();
  const nasc = document.getElementById("nasc")?.value;
  const apl  = document.getElementById("apl")?.value;
  if(!nome) return alert("Informe o nome.");
  if(!nasc) return alert("Informe a data de nascimento.");
  if(!apl)  return alert("Informe a data de aplicação.");

  const idade = diffIdade(nasc, apl);
  const faixa = faixaEtaria(idade);

  const normas = await carregarNormas();
  const pbs = lerPBsDoFormulario();

  const resultados = {};
  for(const st of SUBTESTES){
    const pb = pbs[st.codigo];
    const pp = calcularPonderado(normas, faixa, st.codigo, pb);
    resultados[st.codigo] = {
      codigo: st.codigo,
      nome: st.nome,
      bruto: pb,
      ponderado: pp,
      classificacao: (pp==null?"—":classificarPP(pp))
    };
  }

  const indicesInfo = calcularIndices(resultados);
  const qiInfo = calcularQIT(resultados);

  montarRelatorio({
    nome, nasc, apl, idade, faixa,
    resultados, indicesInfo, qiInfo
  });

  if(salvar){
    const rel = document.getElementById("relatorio");
    if(!rel) return;

    // Gera PDF e salva como arquivo (mantém como já está no seu projeto)
    await html2pdf().set({
      margin: 10,
      filename: `WISC-IV_${nome}.pdf`,
      html2canvas: { scale: 2, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    }).from(rel).save();

    adicionarLaudo({
      nome,
      nasc,
      apl,
      faixa,
      criadoEm: new Date().toISOString(),
      htmlRelatorio: rel.outerHTML
    });

    alert("Laudo salvo!");
  }
}

function montarRelatorio(data){
  const rel = document.getElementById("relatorio");
  if(!rel) return;

  const { nome, nasc, apl, idade, faixa, resultados, indicesInfo, qiInfo } = data;

  const perfil = renderPerfil(resultados);
  const matriz = renderMatrizConversao({ resultados, indicesInfo, qiInfo });

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
          <div class="canvas-wrap perfil-canvas"><canvas id="grafSub" height="520"></canvas></div>
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
        <div class="canvas-wrap"><canvas id="grafIdx" height="300"></canvas></div>

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
  // Perfil: pontos ponderados subtestes
  const cSub = document.getElementById("grafSub");
  if(cSub){
    const ctx = cSub.getContext("2d");

    const labels = ["SM","VC","CO","IN","RP","CB","CN","RM","CF","DG","SNL","AR","CD","PS","CA"];
    const vals = labels.map(c => resultados[c]?.ponderado ?? null);

    if(window.chartSub) window.chartSub.destroy();

    const deco = {
      id:"wiscScatterDecor",
      beforeDraw(chart){
        const { ctx, chartArea, scales } = chart;
        if(!chartArea) return;
        const x = scales.x;
        const y = scales.y;

        // faixa média 9-11
        const y9 = y.getPixelForValue(9);
        const y11 = y.getPixelForValue(11);
        ctx.save();
        ctx.fillStyle = "rgba(13,71,161,0.10)";
        ctx.fillRect(chartArea.left, y11, chartArea.right-chartArea.left, y9-y11);
        ctx.restore();

        // linhas verticais separando domínios (corrigidas)
        const vlines = [5.5, 9.5, 12.5];
        ctx.save();
        ctx.strokeStyle = "rgba(13,71,161,0.35)";
        ctx.lineWidth = 1;
        vlines.forEach(v=>{
          const px = x.getPixelForValue(v);
          ctx.beginPath();
          ctx.moveTo(px, chartArea.top);
          ctx.lineTo(px, chartArea.bottom);
          ctx.stroke();
        });
        ctx.restore();
      }
    };

    window.chartSub = new Chart(ctx, {
      type:"line",
      data:{
        labels,
        datasets:[{
          data: vals.map((v,i)=> ({ x:i+1, y:v })),
          showLine:false,
          pointRadius:4,
          pointHoverRadius:5,
          borderWidth:0
        }]
      },
      options:{
        parsing:false,
        plugins:{ legend:{ display:false } },
        scales:{
          x:{
            type:"linear",
            min:0.5,
            max:15.5,
            grid:{ display:false },
            ticks:{
              autoSkip:false,
              stepSize:1,
              callback:(val)=>{
                const idx = Math.round(val)-1;
                const c = labels[idx];
                if(!c) return "";
                return ["CF","CA","IN","AR","RP"].includes(c) ? `(${c})` : c;
              }
            }
          },
          y:{ min:1, max:19, ticks:{ stepSize:1 } }
        }
      },
      plugins:[deco]
    });
  }

  // Índices e QIT (somatórios): perfil de pontos compostos
  const cIdx = document.getElementById("grafIdx");
  if(cIdx){
    const ctx = cIdx.getContext("2d");

    const labels = ["ICV","IOP","IMO","IVP","QIT"];
    const vals = [
      indicesInfo.ICV?.score ?? indicesInfo.ICV?.composto ?? indicesInfo.ICV?.pontoComposto ?? null,
      indicesInfo.IOP?.score ?? indicesInfo.IOP?.composto ?? indicesInfo.IOP?.pontoComposto ?? null,
      indicesInfo.IMO?.score ?? indicesInfo.IMO?.composto ?? indicesInfo.IMO?.pontoComposto ?? null,
      indicesInfo.IVP?.score ?? indicesInfo.IVP?.composto ?? indicesInfo.IVP?.pontoComposto ?? null,
      qiInfo?.score ?? qiInfo?.composto ?? qiInfo?.pontoComposto ?? null,
    ];

    if(window.chartIdx) window.chartIdx.destroy();

    window.chartIdx = new Chart(ctx, {
      type:"line",
      data:{
        labels,
        datasets:[{
          data: vals,
          showLine:false,
          pointRadius:4,
          pointHoverRadius:5,
          borderWidth:0
        }]
      },
      options:{
        plugins:{ legend:{ display:false } },
        scales:{
          y:{ ticks:{ stepSize:10 } }
        }
      }
    });
  }
}

function montarInputsSubtestes(){
  const box = document.getElementById("subtestesBox");
  if(!box) return;
  box.innerHTML = SUBTESTES.map(st=>`
    <div class="pb-row">
      <label>${st.nome} <span class="muted">(${st.codigo})</span></label>
      <input id="pb_${st.codigo}" type="number" min="0" step="1" inputmode="numeric" />
    </div>
  `).join("");
}

function atualizarPreviewIdade(){
  const nasc = document.getElementById("nasc")?.value;
  const apl  = document.getElementById("apl")?.value;
  const out = document.getElementById("idadeOut");
  if(!out) return;

  if(!nasc || !apl){
    out.textContent = "—";
    return;
  }
  const id = diffIdade(nasc, apl);
  out.textContent = `${id.anos}a ${id.meses}m ${id.dias}d`;
}

async function initNovoLaudo(){
  montarInputsSubtestes();
  const nascEl = document.getElementById("nasc");
  const aplEl  = document.getElementById("apl");
  if(nascEl) nascEl.addEventListener("input", atualizarPreviewIdade);
  if(aplEl)  aplEl.addEventListener("input", atualizarPreviewIdade);

  const btnPrev = document.getElementById("btnPreview");
  const btnSalvar = document.getElementById("btnSalvar");
  if(btnPrev) btnPrev.addEventListener("click", ()=>calcular(false));
  if(btnSalvar) btnSalvar.addEventListener("click", ()=>calcular(true));
}

async function initLaudos(){
  const tbody = document.getElementById("laudosTbody");
  if(!tbody) return;

  const laudos = getLaudos();
  if(!laudos.length){
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Nenhum laudo salvo ainda.</td></tr>`;
    return;
  }

  tbody.innerHTML = laudos.map((l, idx)=>`
    <tr>
      <td><b>${l.nome}</b></td>
      <td>${formatarDataISO(l.apl)}</td>
      <td>${l.faixa}</td>
      <td>${new Date(l.criadoEm).toLocaleString("pt-BR")}</td>
      <td style="white-space:nowrap;">
        <button class="btn-outline" onclick="visualizarLaudo(${idx})">Ver</button>
        <button class="btn-outline" onclick="baixarPDFSalvo(${idx})">Baixar PDF</button>
        <button class="btn-danger" onclick="excluirLaudo(${idx})">Excluir</button>
      </td>
    </tr>
  `).join("");
}

function visualizarLaudo(index){
  const laudos = getLaudos();
  const item = laudos[index];
  if(!item) return alert("Laudo não encontrado.");
  const rel = document.getElementById("relatorio");
  if(!rel) return;
  rel.style.display = "block";
  rel.innerHTML = item.htmlRelatorio;
}

async function baixarPDFSalvo(index){
  const laudos = getLaudos();
  const item = laudos[index];
  if(!item) return alert("Laudo não encontrado.");

  const temp = document.createElement("div");
  temp.innerHTML = item.htmlRelatorio;
  document.body.appendChild(temp);

  await html2pdf().set({
    margin: 10,
    filename: `WISC-IV_${item.nome}.pdf`,
    html2canvas: { scale: 2, backgroundColor: "#ffffff" },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  }).from(temp).save();

  temp.remove();
}

function excluirLaudo(index){
  const laudos = getLaudos();
  laudos.splice(index, 1);
  setLaudos(laudos);
  initLaudos();
}

document.addEventListener("DOMContentLoaded", ()=>{
  const page = document.body.dataset.page;
  if(page === "novo-laudo") initNovoLaudo();
  if(page === "laudos") initLaudos();
});
