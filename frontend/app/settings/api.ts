const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("ks_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${API}${path}`, { ...options, headers }).then(async (res) => {
    if (!res.ok) {
      const e = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(e.detail ?? "Request failed");
    }
    return res.status === 204 ? null : res.json();
  });
}

export async function exportRecipes() {
  const token = localStorage.getItem("ks_token");
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}/api/recipes/`, { headers });
  if (!res.ok) throw new Error("Fehler beim Exportieren");
  return res.json();
}
