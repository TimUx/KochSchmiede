export function validateAdminStep(input: {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  if (!input.username.trim()) return "Benutzername ist erforderlich";
  if (input.username.trim().length < 3) return "Benutzername muss mindestens 3 Zeichen haben";
  if (!input.email.trim()) return "E-Mail-Adresse ist erforderlich";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return "Ungültige E-Mail-Adresse";
  }
  if (!input.password) return "Passwort ist erforderlich";
  if (input.password.length < 8) return "Passwort muss mindestens 8 Zeichen haben";
  if (input.password !== input.confirmPassword) return "Passwörter stimmen nicht überein";
  return null;
}
