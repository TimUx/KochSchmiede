const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("ks_token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(err.detail ?? "Request failed", res.status);
  }

  return res.status === 204 ? null : res.json();
}

export async function uploadAdminAsset(logoType: string, file: File) {
  const token = localStorage.getItem("ks_token");
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API}/api/admin/logos/${logoType}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Upload fehlgeschlagen");
  }

  return res.json();
}
