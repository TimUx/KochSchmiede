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
      "Empfohlenes Modell: gpt-4o (Vision + Text) oder gpt-4o-mini (günstiger).",
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
      "Empfohlenes Modell: gemini-2.5-flash (schnell, günstig) oder gemini-2.5-pro (höchste Qualität).",
    ],
    link: "https://aistudio.google.com/app/apikey",
    linkLabel: "aistudio.google.com/app/apikey",
  },
};

export const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o (empfohlen)" },
    { value: "gpt-4o-mini", label: "GPT-4o mini (schnell & günstig)" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "gpt-4", label: "GPT-4" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  ],
  gemini: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (empfohlen)" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (veraltet)" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (veraltet)" },
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
        "KI-Import: Konfiguriere einen externen KI-Anbieter (OpenAI / Gemini) für bessere Rezept-Erkennung.",
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
