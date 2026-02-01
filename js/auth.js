const AUTH_KEY = "equilibrium_auth_v1";
const AUTH_USER_KEY = "equilibrium_auth_user_v1";

const REPO_BASE = "/Equilibrium_Neuro/";

const USERS = [
  { id: "1", label: "Usuário 1" },
  { id: "2", label: "Usuário 2" },
  { id: "3", label: "Usuário 3" },
  { id: "4", label: "Usuário 4" },
];

function hydrateLoginUsers(selectEl){
  if(!selectEl) return;
  selectEl.innerHTML = USERS.map(u => `<option value="${u.id}">${u.label}</option>`).join("");
}

function setAuth(userId){
  sessionStorage.setItem(AUTH_KEY, "true");
  sessionStorage.setItem(AUTH_USER_KEY, userId);
}

function clearAuth(){
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
}

function isAuthed(){
  return sessionStorage.getItem(AUTH_KEY) === "true";
}

function doLogin({ userId, password }){
  const pwd = String(password || "").trim();
  if(!userId) return { ok:false, message:"Selecione um usuário." };
  if(pwd !== "1234") return { ok:false, message:"Senha inválida." };
  setAuth(userId);
  return { ok:true };
}

function logout(){
  clearAuth();
  location.href = REPO_BASE + "login.html";
}

function guardAuth(){
  const path = (location.pathname || "").toLowerCase();
  const isLogin = path.endsWith("/login.html") || path.endsWith("login.html");
  if(isLogin) return true;

  if(isAuthed()) return true;

  location.href = REPO_BASE + "login.html";
  return false;
}
