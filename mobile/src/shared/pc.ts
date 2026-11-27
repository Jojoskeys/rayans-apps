// Connexion au PC à travers Rayan's Télécommande (Tailscale + code d'association), partagée par les tuiles
// tuiles qui parlent au PC (Télécommande, Papiers, Favoris…) : l'adresse et le code saisis une fois servent à toutes.

export interface Config { adresse: string; code: string }
const CLE = "rm-telecommande";
export const lireConfig = (): Config | null => { try { const c = JSON.parse(localStorage.getItem(CLE) ?? "null"); return c?.adresse && c?.code ? c : null; } catch { return null; } };
export const ecrireConfig = (c: Config | null) => { try { if (c) localStorage.setItem(CLE, JSON.stringify(c)); else localStorage.removeItem(CLE); } catch { /* stockage indisponible */ } };

export const normaliserAdresse = (a: string) => {
  let s = a.trim().replace(/\/+$/, "");
  if (!s) return s;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  return s.replace(/^http:\/\//i, "https://");
};

export const INJOIGNABLE = "PC injoignable. Vérifie : Tailscale activé sur l'iPhone (icône VPN), PC allumé, et Rayan's Télécommande lancée sur le PC (elle démarre quand ta session Windows est ouverte).";

export async function appel<T = Record<string, unknown>>(cfg: Config, chemin: string, options: { methode?: string; corps?: unknown; brut?: boolean; timeout?: number } = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(cfg.adresse + chemin, {
      method: options.methode ?? (options.corps !== undefined ? "POST" : "GET"),
      headers: { Authorization: `Bearer ${cfg.code}`, ...(options.corps !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: options.corps !== undefined ? JSON.stringify(options.corps) : undefined,
      signal: AbortSignal.timeout(options.timeout ?? 15_000),
      cache: "no-store",
    });
  } catch { throw new Error(INJOIGNABLE); }
  if (options.brut && r.ok) return r as unknown as T;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 401 ? "Code incorrect : retape le code affiché sur le PC (Télécommande → Réglages)." : r.status === 403 && /Tailscale/.test(j.erreur ?? "") ? "Accès refusé : l'iPhone doit être connecté à Tailscale avec le même compte que le PC." : r.status === 404 && /adresse inconnue/.test(j.erreur ?? "") ? "Rayan's Télécommande sur le PC est trop ancienne : mets-la à jour avec Rayan's Launcher." : j.erreur ?? `erreur ${r.status}`);
  return j as T;
}

export const taille = (o: number) => o < 1024 ? `${o} o` : o < 1024 ** 2 ? `${(o / 1024).toFixed(0)} Ko` : o < 1024 ** 3 ? `${(o / 1024 ** 2).toFixed(1)} Mo` : `${(o / 1024 ** 3).toFixed(1)} Go`;
export const quand = (t: number) => new Date(t).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
