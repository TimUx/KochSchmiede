const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function fetchSetupStatus() {
  const response = await fetch(`${API}/api/setup/status`);
  return response.json();
}

export async function registerAdmin(payload: {
  username: string;
  email: string;
  password: string;
}) {
  const regRes = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!regRes.ok) {
    const e = await regRes.json().catch(() => ({}));
    throw new Error(e.detail ?? "Registrierung fehlgeschlagen");
  }
}

export async function loginForSetup(username: string, password: string) {
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }).toString(),
  });
  if (!loginRes.ok) throw new Error("Login fehlgeschlagen");
  const { access_token } = await loginRes.json();
  return access_token as string;
}

export async function saveInitialSettings(payload: {
  site_mode: "public" | "private";
  registration_mode: "open" | "admin_only";
}, token: string) {
  const settingsRes = await fetch(`${API}/api/admin/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!settingsRes.ok) throw new Error("Einstellungen konnten nicht gespeichert werden");
}
