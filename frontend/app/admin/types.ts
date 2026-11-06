export interface SiteSettings {
  site_mode: "public" | "private";
  registration_mode: "open" | "admin_only";
  ssrf_protection: boolean;
  logo_light_url?: string | null;
  logo_dark_url?: string | null;
  favicon_url?: string | null;
  appicon_url?: string | null;
  // External AI providers in priority order (keys are never returned)
  ext_ai_providers?: ExtAiProvider[];
}

export interface ExtAiProvider {
  id: string;
  provider: string;
  model?: string | null; // null = automatic
  key_configured: boolean;
}

export interface ExtAiModels {
  auto_model: string;
  models: { id: string; label: string }[];
  error?: string | null;
}

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface UnitRecord {
  id: string;
  name: string;
  position: number;
}
