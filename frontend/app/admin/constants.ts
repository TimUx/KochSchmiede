export const AI_HELP: Record<
  string,
  { title: string; steps: string[]; link: string; linkLabel: string }
> = {
  openai: {
    title: "OpenAI API-Schlüssel erstellen",
    steps: [
      "Öffne platform.openai.com und melde dich an (oder erstelle ein kostenloses Konto).",
      'Klicke oben rechts auf dein Profilbild → „API keys" (oder gehe direkt zu platform.openai.com/api-keys).',
      'Klicke auf „+ Create new secret key", vergib einen Namen (z. B. „KochSchmiede") und bestätige.',
      'Kopiere den angezeigten Schlüssel (er beginnt mit „sk-…") – er wird nur einmal angezeigt!',
      'Füge den Schlüssel oben in das Feld „API-Schlüssel" ein.',
      'Beim Modell „Automatisch" wählt KochSchmiede das aktuelle empfohlene GPT-Modell selbst aus.',
    ],
    link: "https://platform.openai.com/api-keys",
    linkLabel: "platform.openai.com/api-keys",
  },
  gemini: {
    title: "Google Gemini API-Schlüssel erstellen",
    steps: [
      "Öffne aistudio.google.com und melde dich mit deinem Google-Konto an.",
      'Klicke links in der Seitenleiste auf „Get API key" (oder „API-Schlüssel abrufen").',
      'Wähle „Create API key in new project" oder wähle ein bestehendes Google-Cloud-Projekt.',
      'Kopiere den generierten Schlüssel (er beginnt mit „AIza…").',
      'Füge den Schlüssel oben in das Feld „API-Schlüssel" ein.',
      'Beim Modell „Automatisch" wählt KochSchmiede das neueste Gemini-Flash-Modell (schnell, günstig) selbst aus.',
      "Hinweis: Für die API-Nutzung muss im Projekt eine Abrechnung bzw. ein Guthaben eingerichtet sein.",
    ],
    link: "https://aistudio.google.com/app/apikey",
    linkLabel: "aistudio.google.com/app/apikey",
  },
  anthropic: {
    title: "Anthropic (Claude) API-Schlüssel erstellen",
    steps: [
      "Öffne platform.claude.com und melde dich an (oder erstelle ein Konto).",
      'Lade unter „Billing" Guthaben auf – ohne Guthaben lehnt die API Anfragen ab.',
      'Öffne „API Keys" und klicke auf „Create Key", vergib einen Namen (z. B. „KochSchmiede").',
      'Kopiere den Schlüssel (er beginnt mit „sk-ant-…") – er wird nur einmal angezeigt!',
      'Füge den Schlüssel oben in das Feld „API-Schlüssel" ein.',
      'Beim Modell „Automatisch" verwendet KochSchmiede Claude Opus 5.5.',
    ],
    link: "https://platform.claude.com/settings/keys",
    linkLabel: "platform.claude.com/settings/keys",
  },
};

export const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o mini (schnell & günstig)" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "gpt-4", label: "GPT-4" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  ],
  gemini: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (veraltet)" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (veraltet)" },
  ],
  anthropic: [
    { value: "claude-opus-5-5", label: "Claude Opus 5.5" },
    { value: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
    { value: "claude-haiku-5-5", label: "Claude Haiku 5.5 (schnell & günstig)" },
  ],
};

export const ADMIN_HELP = {
  title: "Admin-Bereich",
  sections: [
    {
      heading: "Einstellungen",
      items: [
        "Sichtbarkeit: Lege fest, ob die App öffentlich oder nur für eingeloggte Nutzer sichtbar ist.",
        "Registrierung: Erlaube freie Registrierung oder beschränke sie auf Admin-Einladungen.",
        "Branding: Lade eigene Logos, Favicon und App-Icon hoch.",
        "KI-Import: Konfiguriere einen externen KI-Anbieter (OpenAI / Gemini / Claude) für bessere Rezept-Erkennung. Das Modell wird automatisch gewählt.",
      ],
    },
    {
      heading: "Benutzerverwaltung",
      items: [
        "Lege neue Benutzer an oder deaktiviere bestehende Accounts.",
        "Vergib oder entziehe Admin-Rechte.",
      ],
    },
    {
      heading: "Einheiten",
      items: [
        "Verwalte die Liste der verfügbaren Maßeinheiten für Zutaten.",
      ],
    },
  ],
  docsLinks: [
    {
      label: "Admin-Dokumentation öffnen",
      url: "https://github.com/TimUx/KochSchmiede/blob/main/README.md",
    },
  ],
};
