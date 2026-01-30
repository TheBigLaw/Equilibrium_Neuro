/* === IDADE === */
function calcularIdadeMeses(dataNascimento) {
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let meses = (hoje.getFullYear() - nasc.getFullYear()) * 12;
  meses += hoje.getMonth() - nasc.getMonth();
  if (hoje.getDate() < nasc.getDate()) meses--;
  return meses;
}

/* === FAIXAS MOCK === */
const faixas = [
  { nome: "6:0–6:11", min: 72, max: 83 },
  { nome: "7:0–7:11", min: 84, max: 95 }
];

/* === CÁLCULO === */
function calcular(salvar = false) {
  const nome = document.getElementById("nome").value;
  const nasc = document.getElementById("dataNascimento").value;
  const dataTeste = document.getElementById("dataAplicacao").value;

  const idadeMeses = calcularIdadeMeses(nasc);
  const faixa = faixas.find(f => idadeMeses >= f.min && idadeMeses <= f.max);

  document.getElementById("idadeCalculada").innerText =
    `Faixa etária: ${faixa ? faixa.nome : "fora da norma"}`;

  const resultado = {
    nome,
    dataTeste,
    faixa: faixa ? faixa.nome : "-"
  };

  document.getElementById("resultado").innerHTML =
    `<p><strong>Laudo calculado com sucesso.</strong></p>`;

  if (salvar) salvarLaudo(resultado);
}

/* === SALVAMENTO LOCAL === */
function salvarLaudo(laudo) {
  const lista = JSON.parse(localStorage.getItem("laudos")) || [];
  lista.push(laudo);
  localStorage.setItem("laudos", JSON.stringify(lista));
  alert("Laudo salvo com sucesso.");
}

/* === LISTAGEM === */
function carregarLaudos() {
  const lista = JSON.parse(localStorage.getItem("laudos")) || [];
  const tabela = document.getElementById("tabelaLaudos");

  lista.forEach(l => {
    const row = tabela.insertRow();
    row.innerHTML = `
      <td>${l.nome}</td>
      <td>${l.dataTeste}</td>
      <td>${l.faixa}</td>
      <td><button onclick="window.print()">Imprimir</button></td>
    `;
  });
}
