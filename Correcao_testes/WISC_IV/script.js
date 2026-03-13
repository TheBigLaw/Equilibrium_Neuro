console.log("SCRIPT WISC-IV CARREGADO - API INTEGRAD");
const LAUDOS_KEY = "empresa_laudos_wisc";

const SUBTESTES = [
  { nome: "Cubos", codigo: "CB", id: "pb_CB" },
  { nome: "Semelhanças", codigo: "SM", id: "pb_SM" },
  { nome: "Dígitos", codigo: "DG", id: "pb_DG" },
  { nome: "Conceitos Figurativos", codigo: "CN", id: "pb_CN" },
  { nome: "Código", codigo: "CD", id: "pb_CD" },
  { nome: "Vocabulário", codigo: "VC", id: "pb_VC" },
  { nome: "Seq. Núm. e Letras", codigo: "SNL", id: "pb_SNL" },
  { nome: "Raciocínio Matricial", codigo: "RM", id: "pb_RM" },
  { nome: "Compreensão", codigo: "CO", id: "pb_CO" },
  { nome: "Procurar Símbolos", codigo: "PS", id: "pb_PS" },
  { nome: "Completar Figuras", codigo: "CF", id: "pb_CF" },
  { nome: "Cancelamento", codigo: "CA", id: "pb_CA" },
  { nome: "Informação", codigo: "IN", id: "pb_IN" },
  { nome: "Aritmética", codigo: "AR", id: "pb_AR" },
  { nome: "Raciocínio com Palavras", codigo: "RP", id: "pb_RP" }
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
  faixaEl.textContent = "Faixa normativa será definida no laudo."; // A API fará o cálculo exato da faixa em meses
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

    // ATENÇÃO: COLOQUE AQUI O LINK DO SEU RENDER + /wisc/calcular
    const API_URL = "https://equilibrium-api-yjxx.onrender.com/wisc/calcular"; 

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

// === FUNÇÕES DE RENDERIZAÇÃO DO RELATÓRIO ===

function obterNomeSubteste(codigo){
  const sub = SUBTESTES.find(s => s.codigo === codigo);
  return sub ? sub.nome : codigo;
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
  const usadosQIT = new Set(somas?.QI_TOTAL?.usados || []);

  const possiveis = {
    ICV: new Set(["SM","VC","CO","IN","RP"]),
    IOP: new Set(["CB","CN","RM","CF"]),
    IMO: new Set(["DG","SNL","AR"]),
    IVP: new Set(["CD","PS","CA"]),
    QIT: new Set(["CB","SM","DG","CN","CD","VC","SNL","RM","CO","PS","CF","CA","IN","AR","RP"])
  };

  const ordem = ["CB","SM","DG","CN","CD","VC","SNL","RM","CO","PS","CF","CA","IN","AR","RP"];

  const linhas = ordem.map(codigo => {
    const r = resultados[codigo] || { bruto: "", ponderado: "" };
    const nome = obterNomeSubteste(codigo);
    return `
      <tr>
        <td class="col-sub"><b>${nome}</b> <span class="muted">(${codigo})</span></td>
        <td class="col-pb">${r.bruto ?? ""}</td>
        <td class="col-pp">${r.ponderado ?? ""}</td>
          ${cellIndice(codigo, usadosICV, possiveis.ICV, resultados)}
          ${cellIndice(codigo, usadosIOP, possiveis.IOP, resultados)}
          ${cellIndice(codigo, usadosIMO, possiveis.IMO, resultados)}
          ${cellIndice(codigo, usadosIVP, possiveis.IVP, resultados)}
          ${cellIndice(codigo, usadosQIT, possiveis.QIT, resultados)}
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
        <td>${somas?.QI_TOTAL?.soma ?? "—"}</td>
      </tr>
    </tfoot>
  </table>
`;
}

function formatarCPF(cpf){
  if(!cpf) return "";
  const nums = cpf.replace(/\D/g, "");
  if(nums.length !== 11) return cpf;
  return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function fmtIC(arr){ return !Array.isArray(arr) ? "—" : `${arr[0]}–${arr[1]}`; }

function montarRelatorio(data) {
  const rel = document.getElementById("relatorio");
  if (!rel) return;
  
  const { nome, cpf, sexo, escolaridade, nasc, apl, idade, faixa, resultados, indicesInfo, qiInfo, compostos, somas } = data;
  const cpfTxt = formatarCPF(cpf);
  const matriz = renderMatrizConversao({ resultados, indicesInfo, somas });

  rel.style.display = "block";
  rel.innerHTML = `
    <div class="report">
      <div class="report-header">
        <img class="report-logo report-logo-top" src="/logo2.png" alt="Logo" onerror="this.style.display='none'">
        <div class="report-title">
          <div class="t1">Relatório – WISC-IV</div>
          <div class="t2">Correção automatizada via API</div>
        </div>
        <div class="report-meta"><div class="badge">Faixa: ${faixa.replace("_", " a ")} meses</div><div class="muted">Idade: ${idade.anos}a ${idade.meses}m</div></div>
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
      <div class="section no-break">
        <h3>Conversão PB → Ponderado e contribuição nos Índices</h3>
        <div class="matrix-card">${matriz}</div>
        <p class="muted" style="margin:10px 0 0;">Células azuis indicam subtestes usados na soma do índice/QIT. Suplementares podem aparecer entre parênteses.</p>
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
          <table class="table" style="margin-top:12px;">
          <thead><tr><th>Escala</th><th>Soma</th><th>Composto</th><th>Percentil</th><th>IC 90%</th><th>IC 95%</th></tr></thead>
          <tbody>
              ${[["ICV", "ICV"],["IOP", "IOP"],["IMO", "IMO"],["IVP", "IVP"],["QIT", "QI_TOTAL"]].map(([rotulo, chave]) => {
                const s = somas?.[chave]; const c = compostos?.[chave];
                return `<tr><td><b>${rotulo}</b></td><td>${s?.soma ?? "—"}</td><td>${c?.composto ?? "—"}</td><td>${c?.percentil ?? "—"}</td><td>${fmtIC(c?.ic90)}</td><td>${fmtIC(c?.ic95)}</td></tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
      <div class="report-footer">
        <div class="muted">Documento gerado automaticamente com segurança</div>
        <button class="btn-print no-print" onclick="imprimirRelatorio()">Imprimir (PDF)</button>
        <img class="report-logo report-logo-bottom" src="/logo2.png" alt="Logo" onerror="this.style.display='none'">
      </div>
    </div>`;
}

async function esperarImagensCarregarem(container){
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); });
  }));
}

function renderListaLaudos(){
  const box = document.getElementById("listaLaudos");
  if(!box) return;
  const laudos = getLaudos();
  if(!laudos.length){ box.innerHTML = `<p class="muted">Nenhum laudo salvo ainda.</p>`; return; }
  box.innerHTML = `<table class="table"><thead><tr><th>Paciente</th><th>Aplicação</th><th>Faixa</th><th>Ações</th></tr></thead><tbody>${laudos.map((x, idx)=>`<tr><td>${x.nome}</td><td>${x.dataAplicacao}</td><td><span class="badge">${x.faixa.replace("_", " a ")}</span></td><td><button class="btn-outline" onclick="baixarPDFSalvo(${idx})">Baixar PDF</button></td></tr>`).join("")}</tbody></table>`;
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
  window.print();
  temp.remove();
}

async function imprimirRelatorio(){
  const rel = document.getElementById("relatorio");
  if(!rel) return;
  await esperarImagensCarregarem(rel);
  await new Promise(r => setTimeout(r, 250));
  window.print();
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

// === EXPORTANDO FUNÇÕES PARA O HTML (Evita o erro "is not defined") ===
window.calcular = calcular;
window.imprimirRelatorio = imprimirRelatorio;
window.baixarPDFSalvo = baixarPDFSalvo;
