export interface SiteSettings {
  site_mode: "public" | "private";
  registration_mode: "open" | "admin_only";
  ssrf_protection: boolean;
  logo_light_url?: string | null;
  logo_dark_url?: string | null;
  favicon_url?: string | null;
  appicon_url?: string | null;
  ext_ai_provider?: string | null;
  ext_ai_model?: string | null;
  ext_ai_key_configured?: boolean;
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
