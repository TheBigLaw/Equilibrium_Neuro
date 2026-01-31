/* LOGIN */
function login() {
  const u = usuario.value;
  const s = senha.value;
  if (u === "admin" && s === "1234") {
    sessionStorage.setItem("logado", "true");
    location.href = "index.html";
  } else {
    erro.innerText = "Usuário ou senha inválidos.";
  }
}

/* IDADE EM MESES */
function idadeMeses(data) {
  const hoje = new Date();
  const nasc = new Date(data);
  let m = (hoje.getFullYear() - nasc.getFullYear()) * 12;
  m += hoje.getMonth() - nasc.getMonth();
  if (hoje.getDate() < nasc.getDate()) m--;
  return m;
}

/* FAIXA (EXPANSÍVEL) */
const faixas = [{ nome: "6:0–6:11", min: 72, max: 83 }];

/* CÁLCULO */
function calcular(salvar) {
  const nome = document.getElementById("nome").value;
  const nasc = dataNascimento.value;
  const teste = dataAplicacao.value;
  const indices = calcularIndicesFake();
desenharGraficoIndices(indices);


  if (!nome || !nasc || !teste) {
    alert("Preencha todos os dados de identificação.");
    return;
  }

  const meses = idadeMeses(nasc);
  const faixa = faixas.find(f => meses >= f.min && meses <= f.max);

  r_nome.innerText = nome;
  r_nasc.innerText = nasc;
  r_teste.innerText = teste;
  r_faixa.innerText = faixa ? faixa.nome : "Fora da norma";

  const indices = calcularIndices();

// preencher valores
icv_valor.innerText = indices.icv;
iop_valor.innerText = indices.iop;
imo_valor.innerText = indices.imo;
ivp_valor.innerText = indices.ivp;
qi_valor.innerText  = indices.qi;

// preencher classificações
icv_class.innerText = indices.classificacaoICV;
iop_class.innerText = indices.classificacaoIOP;
imo_class.innerText = indices.classificacaoIMO;
ivp_class.innerText = indices.classificacaoIVP;
qi_class.innerText  = indices.classificacaoQI;

// gráficos
desenharGraficoIndices(indices);


  desenharGraficoSubtestes();

  if (salvar) {
    const lista = JSON.parse(localStorage.getItem("laudos")) || [];
    lista.push({ nome, teste, faixa: faixa ? faixa.nome : "-" });
    localStorage.setItem("laudos", JSON.stringify(lista));
    alert("Laudo salvo com sucesso.");
  }
  
}

/* GRÁFICO DE LINHA */
function desenharGraficoSubtestes() {
  const valores = [
    cubos.value, semelhancas.value, digitos.value, conceitos.value,
    codigo.value, vocabulario.value, sequencia.value,
    matricial.value, compreensao.value, simbolos.value
  ].map(Number);

  const canvas = document.getElementById("graficoSubtestes");
  const ctx = canvas.getContext("2d");
  const pad = 40;
  const max = 19;

  ctx.clearRect(0,0,canvas.width,canvas.height);

  ctx.beginPath();
  valores.forEach((v,i)=>{
    const x = pad + i*(canvas.width-2*pad)/(valores.length-1);
    const y = canvas.height-pad-(v/max)*(canvas.height-2*pad);
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.strokeStyle="#1f4fa3";
  ctx.lineWidth=2;
  ctx.stroke();
}

/* LISTAGEM */
function carregarLaudos() {
  const lista = JSON.parse(localStorage.getItem("laudos")) || [];
  const t = document.getElementById("tabelaLaudos");
  lista.forEach(l=>{
    const r=t.insertRow();
    r.innerHTML=`<td>${l.nome}</td><td>${l.teste}</td><td>${l.faixa}</td>`;
  });
}

function desenharGraficoIndices(indices) {
  const canvas = document.getElementById("graficoIndices");
  const ctx = canvas.getContext("2d");

  const labels = ["ICV", "IOP", "IMO", "IVP", "QI"];
  const valores = [
    indices.icv,
    indices.iop,
    indices.imo,
    indices.ivp,
    indices.qi
  ];

  const pad = 40;
  const max = 160;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  valores.forEach((v, i) => {
    const x = pad + i * (canvas.width - 2 * pad) / (valores.length - 1);
    const y = canvas.height - pad - (v / max) * (canvas.height - 2 * pad);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });

  ctx.strokeStyle = "#1f4fa3";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function calcularIndicesFake() {
  return {
    icv: 100,
    iop: 102,
    imo: 98,
    ivp: 95,
    qi: 99
  };
}

async function gerarPDF() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");

  pdf.setFont("Helvetica");
  pdf.setFontSize(14);
  pdf.text("Relatório Psicológico – WISC-IV", 105, 15, { align: "center" });

  pdf.setFontSize(10);
  pdf.text(`Nome: ${r_nome.innerText}`, 20, 30);
  pdf.text(`Nascimento: ${r_nasc.innerText}`, 20, 36);
  pdf.text(`Aplicação: ${r_teste.innerText}`, 20, 42);
  pdf.text(`Faixa etária: ${r_faixa.innerText}`, 20, 48);

  pdf.text("Índices Cognitivos", 20, 105);
pdf.text(`ICV: ${indices.icv} (${indices.classificacaoICV})`, 20, 112);
pdf.text(`IOP: ${indices.iop} (${indices.classificacaoIOP})`, 20, 118);
pdf.text(`IMO: ${indices.imo} (${indices.classificacaoIMO})`, 20, 124);
pdf.text(`IVP: ${indices.ivp} (${indices.classificacaoIVP})`, 20, 130);
pdf.text(`QI Total: ${indices.qi} (${indices.classificacaoQI})`, 20, 136);


  // Gráfico Subtestes
  const g1 = document.getElementById("graficoSubtestes").toDataURL("image/png");
  pdf.addImage(g1, "PNG", 15, 60, 180, 60);

  // Gráfico Índices
  const g2 = document.getElementById("graficoIndices").toDataURL("image/png");
  pdf.addPage();
  pdf.text("Perfil dos Índices Cognitivos", 105, 15, { align: "center" });
  pdf.addImage(g2, "PNG", 15, 25, 180, 60);

  pdf.setFontSize(9);
  pdf.text(
    "Os resultados devem ser interpretados exclusivamente por psicólogo habilitado.",
    20, 100
  );

  pdf.text("_______________________________________", 50, 130);
  pdf.text("Psicólogo Responsável – CRP", 65, 136);

  pdf.save(`WISC-IV_${r_nome.innerText}.pdf`);
}

function classificarQI(pontuacao) {
  if (pontuacao >= 130) return "Muito Superior";
  if (pontuacao >= 120) return "Superior";
  if (pontuacao >= 110) return "Média Superior";
  if (pontuacao >= 90)  return "Média";
  if (pontuacao >= 80)  return "Média Inferior";
  if (pontuacao >= 70)  return "Limítrofe";
  return "Muito Inferior";
}

function calcularIndices() {
  // futuramente: soma de pontos ponderados + tabela normativa
  const indices = {
    icv: 100,
    iop: 102,
    imo: 98,
    ivp: 95,
    qi: 99
  };

  indices.classificacaoICV = classificarQI(indices.icv);
  indices.classificacaoIOP = classificarQI(indices.iop);
  indices.classificacaoIMO = classificarQI(indices.imo);
  indices.classificacaoIVP = classificarQI(indices.ivp);
  indices.classificacaoQI  = classificarQI(indices.qi);

  return indices;
}
