const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export function toAbsoluteAssetUrl(url: string) {
  return url.startsWith("http") ? url : `${API}${url}`;
}

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

export async function uploadRecipeImage(file: File): Promise<string> {
  const token = localStorage.getItem("ks_token");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/api/recipes/upload-image`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(e.detail ?? "Bild-Upload fehlgeschlagen");
  }
  const data = await res.json();
  return data.url;
}
