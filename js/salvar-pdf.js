import { storage } from "./firebase.js";

import {
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export async function salvarPDF(blob,nomePaciente,teste){

  const nomeArquivo = `${nomePaciente} - ${teste}.pdf`;

  const caminho = `laudos/${teste}/${nomeArquivo}`;

  const arquivoRef = ref(storage,caminho);

  await uploadBytes(arquivoRef,blob);

  console.log("PDF salvo com sucesso");

}
