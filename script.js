/* =========================
   AUTH (Login simples)
========================= */
function login() {
  const u = document.getElementById("user");
  const p = document.getElementById("pass");
  if (!u || !p) return;

  if (u.value === "admin" && p.value === "1234") {
    localStorage.setItem("auth", "ok");
    location.href = "index.html";
  } else {
    alert("Usuário ou senha inválidos");
  }
}

(function enforceAuth() {
  const isLogin = location.pathname.includes("login");
  if (!isLogin && !localStorage.getItem("auth")) {
    location.href = "login.html";
  }
})();

/* =========================
   CONFIG
========================= */
const SUBTESTES = ["CB","SM","DG","CN","CD","VC","SNL","RM","CO","PS","CF","CA","IN","AR","RP"];

// Índices = SOMA de subtestes (fixo, como você explicou)
const COMPOSICAO = {
  ICV: ["CB", "SM", "VC"],
  IOP: ["DG", "CN", "RM"],
  IMO: ["CD", "SNL"],
  IVP: ["PS", "CF"],
  // QI = soma de TODOS os ponderados que existirem (principais e suplementares que você usar)
};

let NORMAS = null;

/* =========================
   UTIL: carregar normas
========================= */
async function carregarNormas() {
  if (NORMAS) return NORMAS;
  const resp = await fetch("data/normas-wisciv.json");
  if (!resp.ok) throw new Error("Não consegui carregar data/normas-wisciv.json");
  NORMAS = await resp.json();
  return NORMAS;
}

/* =========================
   UTIL: idade e faixa
========================= */
function calcularIdade(nascISO, aplISO) {
  if (!nascISO || !aplISO) return null;
  const n = new Date(nascISO);
  const a = new Date(aplISO);

  if (isNaN(n.getTime()) || isNaN(a.getTime())) return null;
  if (a < n) return null;

  let anos = a.getFullYear() - n.getFullYear();
  let meses = a.getMonth() - n.getMonth();

  if (meses < 0) {
    anos--;
    meses += 12;
  }
  return { anos, meses };
}

function faixaEtariaPorMeses(normas, idade) {
  if (!idade) return null;
  const totalMeses = idade.anos * 12 + idade.meses;

  for (const faixa of Object.keys(normas)) {
    // formato esperado: "6:0-6:3"
    const [ini, fim] = faixa.split("-");
    if (!ini || !fim) continue;

    const [ai, mi] = ini.split(":").map(Number);
    const [af, mf] = fim.split(":").map(Number);
    if ([ai,mi,af,mf].some(x => Number.isNaN(x))) continue;

    const min = ai * 12 + mi;
    const max = af * 12 + mf;
    if (totalMeses >= min && totalMeses <= max) return faixa;
  }
  return null;
}

/* =========================
   CLASSIFICAÇÕES (fixas)
========================= */
function classificarPonderado(p) {
  // padrão comum para score escalonado 1–19
  if (p <= 4) return "Muito Inferior";
  if (p <= 6) return "Inferior";
  if (p <= 8) return "Médio Inferior";
  if (p <= 11) return "Médio";
  if (p <= 13) return "Médio Superior";
  if (p <= 15) return "Superior";
  return "Muito Superior";
}

function classificarQI(qi) {
  // faixas padrão (ajustável)
  if (qi <= 69) return "Muito Inferior";
  if (qi <= 79) return "Limítrofe";
  if (qi <= 89) return "Médio Inferior";
  if (qi <= 109) return "Médio";
  if (qi <= 119) return "Médio Superior";
  if (qi <= 129) return "Superior";
  return "Muito Superior";
}

/* =========================
   CONVERSÃO: bruto -> ponderado
========================= */
function brutoParaPonderado(normas, faixa, subteste, bruto) {
  const regras = normas?.[faixa]?.subtestes?.[subteste];
  if (!regras || !Array.isArray(regras)) return null;
  const r = regras.find(x => bruto >= x.min && bruto <= x.max);
  return r ? Number(r.ponderado) : null;
}

/* =========================
   UI: montar inputs
========================= */
(function montarCamposSubtestes() {
  const container = document.getElementById("subtestes");
  if (!container) return;

  container.innerHTML = "";
  for (const s of SUBTESTES) {
    const div = document.createElement("div");
    div.innerHTML = `
      <label>${s}</label>
      <input type="number" id="${s}" min="0" placeholder="Ponto bruto">
    `;
    container.appendChild(div);
  }
})();

/* =========================
   CÁLCULO PRINCIPAL + PDF
========================= */
async function calcularLaudo() {
  try {
    const normas = await carregarNormas();

    const nome = document.getElementById("nome")?.value?.trim();
    const nascimento = document.getElementById("nascimento")?.value;
    const aplicacao = document.getElementById("aplicacao")?.value;

    if (!nome || !nascimento || !aplicacao) {
      alert("Preencha nome, data de nascimento e data de aplicação.");
      return;
    }

    const idade = calcularIdade(nascimento, aplicacao);
    if (!idade) {
      alert("Datas inválidas (verifique nascimento e aplicação).");
      return;
    }

    const faixa = faixaEtariaPorMeses(normas, idade);
    if (!faixa) {
      alert("Faixa etária não encontrada nas normas.");
      return;
    }

    // 1) Coletar pontos brutos e converter para ponderados
    const resultados = {};      // por subteste: { bruto, ponderado, classificacao }
    const ponderados = {};      // por subteste: ponderado (para somas e gráficos)

    for (const s of SUBTESTES) {
      const campo = document.getElementById(s);
      const raw = campo?.value;
      if (raw === "" || raw == null) {
        // permite deixar suplementares vazios, mas principais você provavelmente quer obrigar.
        // aqui: se estiver vazio, ignora (não entra na soma do QI).
        continue;
      }

      const bruto = Number(raw);
      if (Number.isNaN(bruto) || bruto < 0) {
        alert(`Valor inválido em ${s}.`);
        return;
      }

      const pond = brutoParaPonderado(normas, faixa, s, bruto);
      if (pond == null) {
        alert(`Ponto bruto fora da norma em ${s} (faixa ${faixa}).`);
        return;
      }

      resultados[s] = {
        bruto,
        ponderado: pond,
        classificacao: classificarPonderado(pond)
      };
      ponderados[s] = pond;
    }

    // Garantia mínima: se não tiver nenhum ponderado, não faz sentido gerar laudo
    if (Object.keys(ponderados).length === 0) {
      alert("Preencha pelo menos um subteste com ponto bruto.");
      return;
    }

    // 2) Somar índices (fixo, sem norma)
    const indices = {};
    for (const [indice, subs] of Object.entries(COMPOSICAO)) {
      let soma = 0;
      let ok = true;
      for (const s of subs) {
        if (ponderados[s] == null) {
          ok = false; // faltou algum subteste necessário para esse índice
          break;
        }
        soma += ponderados[s];
      }
      indices[indice] = ok ? soma : null;
    }

    // 3) QI = soma de todos os ponderados preenchidos
    const qi = Object.values(ponderados).reduce((a,b) => a + b, 0);

    // 4) Classificações
    const classificacoesIndices = {
      ICV: indices.ICV == null ? "—" : "Soma dos ponderados",
      IOP: indices.IOP == null ? "—" : "Soma dos ponderados",
      IMO: indices.IMO == null ? "—" : "Soma dos ponderados",
      IVP: indices.IVP == null ? "—" : "Soma dos ponderados",
      QI: classificarQI(qi)
    };

    // 5) Gerar relatório (HTML) + gráficos + PDF
    gerarRelatorioPDF({
      paciente: { nome, nascimento, aplicacao, idade, faixa },
      resultados,
      ponderados,
      indices,
      qi,
      classificacoesIndices
    });

  } catch (e) {
    console.error(e);
    alert("Erro ao gerar laudo. Confira se o arquivo JSON está em /data e rodando via servidor.");
  }
}

/* =========================
   RELATÓRIO + GRÁFICOS + PDF
========================= */
function gerarRelatorioPDF(data) {
  const { paciente, resultados, ponderados, indices, qi, classificacoesIndices } = data;

  // remove relatório anterior
  const old = document.getElementById("relatorio");
  if (old) old.remove();

  // construir HTML
  const area = document.createElement("div");
  area.id = "relatorio";
  area.style.padding = "18px";
  area.style.background = "#ffffff";
  area.style.borderRadius = "16px";
  area.style.boxShadow = "0 10px 26px rgba(0,0,0,.10)";
  area.style.maxWidth = "900px";
  area.style.margin = "20px auto";

  const idadeTxt = `${paciente.idade.anos} anos e ${paciente.idade.meses} meses`;

  const linhasSub = Object.keys(ponderados);
  const valsSub = linhasSub.map(k => ponderados[k]);

  const labelsIdx = ["ICV","IOP","IMO","IVP","QI"];
  const valsIdx = [
    indices.ICV ?? null,
    indices.IOP ?? null,
    indices.IMO ?? null,
    indices.IVP ?? null,
    qi
  ];

  // tabela resultados
  const linhasTabela = Object.entries(resultados).map(([k,v]) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e0e0e0;"><b>${k}</b></td>
      <td style="padding:8px;border-bottom:1px solid #e0e0e0;">${v.bruto}</td>
      <td style="padding:8px;border-bottom:1px solid #e0e0e0;">${v.ponderado}</td>
      <td style="padding:8px;border-bottom:1px solid #e0e0e0;">${v.classificacao}</td>
    </tr>
  `).join("");

  area.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="logo.png" alt="Logo" style="height:44px;object-fit:contain;" onerror="this.style.display='none'">
        <div>
          <div style="font-size:18px;font-weight:600;color:#0d47a1;">Laudo WISC-IV</div>
          <div style="font-size:12px;color:#607d8b;">Gerado automaticamente</div>
        </div>
      </div>
      <div style="font-size:12px;color:#607d8b;text-align:right;">
        <div><b>Faixa:</b> ${paciente.faixa}</div>
        <div><b>Idade:</b> ${idadeTxt}</div>
      </div>
    </div>

    <div style="margin-top:14px;background:#e3f2fd;border-radius:14px;padding:14px;">
      <div style="font-size:14px;"><b>Paciente:</b> ${paciente.nome}</div>
      <div style="font-size:13px;color:#455a64;margin-top:4px;">
        <b>Nascimento:</b> ${paciente.nascimento} &nbsp;&nbsp; | &nbsp;&nbsp;
        <b>Aplicação:</b> ${paciente.aplicacao}
      </div>
    </div>

    <div style="margin-top:18px;">
      <div style="font-size:15px;font-weight:600;color:#0d47a1;margin-bottom:10px;">Perfil de Subtestes (Pontos Ponderados)</div>
      <canvas id="grafSub" height="160"></canvas>
    </div>

    <div style="margin-top:18px;">
      <div style="font-size:15px;font-weight:600;color:#0d47a1;margin-bottom:10px;">Índices (Somas) e QI (Soma Total)</div>
      <canvas id="grafIdx" height="160"></canvas>
    </div>

    <div style="margin-top:18px;">
      <div style="font-size:15px;font-weight:600;color:#0d47a1;margin-bottom:10px;">Tabela de Resultados</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #bbdefb;">Subteste</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #bbdefb;">Bruto</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #bbdefb;">Ponderado</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #bbdefb;">Classificação</th>
          </tr>
        </thead>
        <tbody>
          ${linhasTabela}
        </tbody>
      </table>
    </div>

    <div style="margin-top:18px;background:#f5faff;border-radius:14px;padding:14px;">
      <div style="font-size:14px;font-weight:600;color:#0d47a1;">Resumo</div>
      <div style="font-size:13px;color:#37474f;margin-top:8px;line-height:1.5;">
        <b>ICV:</b> ${indices.ICV ?? "—"} &nbsp; | &nbsp;
        <b>IOP:</b> ${indices.IOP ?? "—"} &nbsp; | &nbsp;
        <b>IMO:</b> ${indices.IMO ?? "—"} &nbsp; | &nbsp;
        <b>IVP:</b> ${indices.IVP ?? "—"} <br>
        <b>QI (soma total):</b> ${qi} &nbsp; — &nbsp; <b>Classificação:</b> ${classificacoesIndices.QI}
      </div>
      <div style="font-size:11px;color:#607d8b;margin-top:10px;">
        * Índices são somas dos pontos ponderados dos subtestes que os compõem. QI é a soma total dos ponderados preenchidos.
      </div>
    </div>
  `;

  document.body.appendChild(area);

  // Gráfico Subtestes (ponderados 1..19)
  const ctxSub = document.getElementById("grafSub");
  new Chart(ctxSub, {
    type: "line",
    data: {
      labels: linhasSub,
      datasets: [{
        data: valsSub,
        borderWidth: 2,
        tension: 0.35
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 1, max: 19 }
      }
    }
  });

  // Gráfico Índices e QI (somas)
  const ctxIdx = document.getElementById("grafIdx");
  new Chart(ctxIdx, {
    type: "line",
    data: {
      labels: labelsIdx,
      datasets: [{
        data: valsIdx,
        borderWidth: 2,
        tension: 0.35
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // PDF
  setTimeout(() => {
    html2pdf().set({
      filename: `WISC-IV_${paciente.nome}.pdf`,
      margin: 10,
      html2canvas: { scale: 2 },
      jsPDF: { format: "a4" }
    }).from(area).save();
  }, 650);
}
