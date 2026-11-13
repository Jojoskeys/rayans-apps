// Barre de commande : ce que l'on tape (« img 1mo », « eteins 45 », « son casque »…) devient une action.

export type ToolId = "pdf" | "img" | "tel" | "wifi" | "son" | "texte" | "eteins";

export interface Tool { id: ToolId; command: string; title: string; hint: string; aliases: string[] }

export const TOOLS: Tool[] = [
  { id: "pdf", command: "pdf", title: "Fusionner en PDF", hint: "Photos et PDF → un seul PDF léger", aliases: ["fusion", "fusionner", "scan"] },
  { id: "img", command: "img 1mo", title: "Alléger une image", hint: "Sous une taille donnée : img 500ko, img 2mo", aliases: ["image", "photo", "compresser", "reduire"] },
  { id: "tel", command: "tel", title: "Échanger avec le téléphone", hint: "QR code : envoyer un fichier, un lien, ou recevoir des photos", aliases: ["telephone", "phone", "envoyer", "qr", "partage"] },
  { id: "wifi", command: "wifi", title: "Mot de passe Wi-Fi", hint: "Réseau connecté, clé et QR code pour un invité", aliases: ["wi-fi", "wlan", "reseau"] },
  { id: "son", command: "son", title: "Sortie audio", hint: "son : sortie suivante · son casque : par son nom", aliases: ["audio", "casque", "enceintes", "hautparleurs"] },
  { id: "texte", command: "texte", title: "Copier le texte de l'écran", hint: "Sélectionnez une zone, le texte est copié", aliases: ["ocr", "copier", "lire"] },
  { id: "eteins", command: "eteins 45", title: "Éteindre plus tard", hint: "eteins 45 · eteins 1h30 · veille 20 · redemarre 10 · eteins annuler", aliases: ["eteindre", "arret", "veille", "redemarre", "redemarrer", "shutdown"] },
];

export type PowerMode = "eteindre" | "redemarrer" | "veille";

export type Parsed =
  | { tool: "pdf" }
  | { tool: "img"; targetKo: number | null }
  | { tool: "tel"; text: string | null }
  | { tool: "wifi" }
  | { tool: "son"; query: string | null }
  | { tool: "texte" }
  | { tool: "eteins"; mode: PowerMode; minutes: number | null; cancel: boolean };

export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** « 1mo », « 1,5 mo », « 500ko », « 800 » (Ko) → kilo-octets. */
export function parseSize(s: string): number | null {
  const m = fold(s).replace(",", ".").match(/^(\d+(?:\.\d+)?)\s*(mo|mb|m|ko|kb|k)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2] ?? "ko";
  const ko = unit.startsWith("m") ? n * 1024 : n;
  return ko >= 20 && ko <= 100 * 1024 ? Math.round(ko) : null;
}

/** « 45 », « 45min », « 1h30 », « 2h », « 1 h 15 » → minutes. */
export function parseDuration(s: string): number | null {
  const f = fold(s).replace(/\s+/g, "");
  let m = f.match(/^(\d{1,4})(?:m|mn|min|minutes?)?$/);
  if (m) return clampMinutes(Number(m[1]));
  m = f.match(/^(\d{1,2})h(?:(\d{1,2})(?:m|mn|min)?)?$/);
  if (m) return clampMinutes(Number(m[1]) * 60 + Number(m[2] ?? 0));
  return null;
}
const clampMinutes = (n: number) => (n >= 1 && n <= 24 * 60 ? n : null);

/** Outil désigné par le premier mot (commande ou alias, sans accents), ou null. */
export function toolOf(word: string): Tool | null {
  const w = fold(word);
  if (!w) return null;
  return TOOLS.find((t) => t.id === w || t.aliases.includes(w)) ?? null;
}

export function parse(input: string): Parsed | null {
  const raw = input.trim();
  const [first = "", ...rest] = raw.split(/\s+/);
  const arg = rest.join(" ");
  const t = toolOf(first);
  if (!t) return null;
  const w = fold(first);
  switch (t.id) {
    case "pdf": return { tool: "pdf" };
    case "img": return { tool: "img", targetKo: arg ? parseSize(arg) : null };
    case "tel": return { tool: "tel", text: arg || null };
    case "wifi": return { tool: "wifi" };
    case "texte": return { tool: "texte" };
    case "son": {
      // « casque » ou « enceintes » tapés seuls : on cherche cette sortie.
      const q = arg || (["casque", "enceintes", "hautparleurs"].includes(w) ? w : "");
      return { tool: "son", query: q || null };
    }
    case "eteins": {
      const mode: PowerMode = w === "veille" ? "veille" : w.startsWith("redemarre") ? "redemarrer" : "eteindre";
      const a = fold(arg);
      if (["annuler", "annule", "stop", "non"].includes(a)) return { tool: "eteins", mode, minutes: null, cancel: true };
      return { tool: "eteins", mode, minutes: a ? parseDuration(a) : null, cancel: false };
    }
  }
}

/** Suggestions pour la barre de commande : outils dont la commande ou un alias commence par ce qui est tapé. */
export function suggest(input: string): Tool[] {
  const w = fold(input.split(/\s+/)[0] ?? "");
  if (!w) return TOOLS;
  const exact = toolOf(w);
  const starts = TOOLS.filter((t) => t !== exact && (t.id.startsWith(w) || t.aliases.some((a) => a.startsWith(w)) || fold(t.title).includes(w)));
  return exact ? [exact, ...starts] : starts;
}

export function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

/** Texte d'un QR code Wi-Fi (format reconnu par les appareils photo d'Android et d'iPhone). */
export function wifiQrText(ssid: string, key: string | null, security: string | null) {
  const esc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
  const open = !key || /^open$/i.test(security ?? "");
  const type = open ? "nopass" : /wep/i.test(security ?? "") ? "WEP" : "WPA";
  return `WIFI:T:${type};S:${esc(ssid)};${open ? "" : `P:${esc(key!)};`};`;
}

/** Choix de la sortie audio : celle dont le nom contient la recherche, sinon la suivante après celle par défaut. */
export function pickOutput<T extends { id: string; nom: string; parDefaut: boolean }>(outputs: T[], query: string | null): T | null {
  if (!outputs.length) return null;
  if (query) {
    const q = fold(query);
    const synonyms: Record<string, string[]> = { casque: ["casque", "headset", "headphone", "ecouteur", "airpods", "buds"], enceintes: ["enceinte", "haut-parleur", "speaker", "realtek"], hautparleurs: ["haut-parleur", "speaker"] };
    const keys = synonyms[q] ?? [q];
    const isHeadset = (o: T) => synonyms.casque.some((k) => fold(o.nom).includes(k));
    // Un casque s'appelle souvent « Haut-parleurs (… Headset) » : « enceintes » ne doit pas le choisir.
    const candidates = q === "casque" || !synonyms[q] ? outputs : outputs.filter((o) => !isHeadset(o));
    return candidates.find((o) => keys.some((k) => fold(o.nom).includes(k)))
      ?? (synonyms[q] && q !== "casque" ? candidates.find((o) => !o.parDefaut) ?? null : null);
  }
  const i = outputs.findIndex((o) => o.parDefaut);
  return outputs[(i + 1) % outputs.length];
}
