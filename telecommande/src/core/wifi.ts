// Lecture de la sortie de « netsh wlan » (Windows en français ou en anglais).

export interface EtatWifi { connecte: boolean; ssid: string | null; signal: number | null; profil: string | null }

const champ = (texte: string, noms: string[]) => {
  for (const ligne of texte.split(/\r?\n/)) {
    const m = ligne.match(/^\s*([^:]+?)\s*:\s(.*)$/);
    if (!m) continue;
    const cle = m[1].trim().toLowerCase();
    if (noms.some((n) => cle === n)) return m[2].trim();
  }
  return null;
};

/** `netsh wlan show interfaces` → réseau actuel. */
export function lireInterfaces(texte: string): EtatWifi {
  const etat = champ(texte, ["état", "state", "etat"]);
  const connecte = !!etat && /connect/i.test(etat) && !/déconnect|disconnect/i.test(etat);
  const ssid = champ(texte, ["ssid"]);
  const sig = champ(texte, ["signal"]);
  const profil = champ(texte, ["profil", "profile"]);
  return { connecte, ssid: connecte ? ssid : null, signal: sig ? parseInt(sig, 10) || null : null, profil: connecte ? profil : null };
}

/** `netsh wlan show profiles` → noms des réseaux enregistrés. */
export function lireProfils(texte: string): string[] {
  const out: string[] = [];
  for (const ligne of texte.split(/\r?\n/)) {
    const m = ligne.match(/^\s*(?:Profil Tous les utilisateurs|All User Profile|Profil utilisateur actuel|Current User Profile)\s*:\s(.+)$/i);
    if (m && m[1].trim()) out.push(m[1].trim());
  }
  return [...new Set(out)];
}

/** Nom de profil sûr à passer à netsh (on refuse guillemets et retours à la ligne). */
export function profilValide(nom: string, connus: string[]): boolean {
  return typeof nom === "string" && !/["\r\n]/.test(nom) && connus.includes(nom);
}
