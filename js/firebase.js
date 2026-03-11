import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCsqUBa4-_PhfbCUIaPyNRQfXLNfVEuDms",
  authDomain: "correcao-testes-neuro.firebaseapp.com",
  projectId: "correcao-testes-neuro",
  storageBucket: "correcao-testes-neuro.firebasestorage.app",
  messagingSenderId: "1032995857800",
  appId: "1:1032995857800:web:9db8f8b12e4996a4ba463d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
