export const LANGUAGES = [
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

export const SETTINGS_HELP = {
  title: "Einstellungen",
  sections: [
    {
      items: [
        "Darstellung: Wechsle zwischen hellem und dunklem Design.",
        "Sprache: Stelle die Anzeigesprache der App ein (Deutsch / Englisch).",
        "Display-Wachhalten: Verhindert, dass der Bildschirm beim Kochen ausgeht.",
        "Passwort ändern: Lege ein neues Passwort für deinen Account fest.",
        "Daten exportieren: Lade alle deine Rezepte als JSON-Datei herunter.",
        "Administratoren finden zusätzlich einen Link zum Admin-Bereich.",
      ],
    },
  ],
  docsLinks: [
    {
      label: "Benutzerhandbuch öffnen",
      url: "https://github.com/TimUx/KochSchmiede/blob/main/USERGUIDE.md",
    },
  ],
};
