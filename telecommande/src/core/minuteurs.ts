// Rappels de fin de minuteur pour Rayan's Chrono sur l'iPhone. L'iPhone met l'app en pause écran éteint : il
// confie donc la fin du minuteur au PC, qui envoie une notification Web Push à l'heure prévue (par Apple).
// Ce module ne fait que tenir la liste ; l'envoi est dans main/push.ts.

export interface Abonnement { endpoint: string; keys: { p256dh: string; auth: string } }
export interface Rappel { abonnement: Abonnement; fin: number; titre: string; texte: string }

/** Services de notification connus : le PC n'envoie jamais de requête ailleurs. */
const SERVICES = [/^web\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];
const B64URL = /^[A-Za-z0-9_-]{10,200}={0,2}$/;
export const DUREE_MAX = 24 * 3600_000;

export class ErreurRappel extends Error {}

export function abonnementValide(a: unknown): Abonnement {
  const o = a as Partial<Abonnement> | null;
  let u: URL;
  try { u = new URL(String(o?.endpoint ?? "")); } catch { throw new ErreurRappel("abonnement aux notifications invalide"); }
  if (u.protocol !== "https:" || !SERVICES.some((s) => s.test(u.hostname))) throw new ErreurRappel("service de notification inconnu");
  const k = o?.keys;
  if (!k || typeof k.p256dh !== "string" || typeof k.auth !== "string" || !B64URL.test(k.p256dh) || !B64URL.test(k.auth)) throw new ErreurRappel("clés de l'abonnement invalides");
  return { endpoint: u.href, keys: { p256dh: k.p256dh, auth: k.auth } };
}

const texte = (v: unknown, defaut: string, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : defaut);

/** Programme (ou remplace) le rappel de cet appareil. `dansMs` : temps restant mesuré sur l'iPhone (pas d'heure
 *  absolue : les horloges du PC et de l'iPhone peuvent différer). */
export function programmer(liste: Rappel[], corps: Record<string, unknown>, now: number): Rappel[] {
  const abonnement = abonnementValide(corps.abonnement);
  const dans = Number(corps.dansMs);
  if (!Number.isFinite(dans) || dans < 0 || dans > DUREE_MAX) throw new ErreurRappel("durée du minuteur invalide");
  const r: Rappel = { abonnement, fin: now + Math.round(dans), titre: texte(corps.titre, "Rayan's Chrono", 80), texte: texte(corps.texte, "Le minuteur est terminé.", 200) };
  return [...annuler(liste, abonnement.endpoint), r];
}

export function annuler(liste: Rappel[], endpoint: unknown): Rappel[] {
  return liste.filter((r) => r.abonnement.endpoint !== endpoint);
}

/** Sépare les rappels arrivés à échéance des autres. Ceux restés en attente trop longtemps (PC éteint) sont abandonnés. */
export function echus(liste: Rappel[], now: number, retardMax = 10 * 60_000): { aEnvoyer: Rappel[]; restants: Rappel[] } {
  const aEnvoyer = liste.filter((r) => r.fin <= now && now - r.fin <= retardMax);
  return { aEnvoyer, restants: liste.filter((r) => r.fin > now) };
}

/** Relit le fichier : ne garde que les rappels bien formés. */
export function normaliserRappels(v: unknown): Rappel[] {
  if (!Array.isArray(v)) return [];
  const out: Rappel[] = [];
  for (const r of v) {
    try { if (Number.isFinite(r?.fin)) out.push({ abonnement: abonnementValide(r.abonnement), fin: r.fin, titre: texte(r.titre, "Rayan's Chrono", 80), texte: texte(r.texte, "", 200) }); }
    catch { /* ignoré */ }
  }
  return out;
}
