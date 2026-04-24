const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("ks_token") : null;
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${API}${path}`, { ...options, headers }).then(async (res) => {
    if (!res.ok) {
      const e = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(e.detail ?? "Request failed");
    }
    return res.status === 204 ? null : res.json();
  });
}
