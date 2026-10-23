export function clearAuthSession() {
  localStorage.removeItem("ks_token");
  localStorage.removeItem("ks_username");
}
