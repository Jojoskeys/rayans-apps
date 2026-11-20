// Envoi sur Discord par webhook : une « carte » (embed) par bonne affaire, dans le salon choisi.
// Le lien du webhook vaut un mot de passe : il reste dans reglages.json, ignoré par git.

/** Une carte Discord (format « embed » de l'API). */
export interface Carte {
  title: string;
  url?: string;
  description?: string;
  color?: number;
  thumbnail?: { url: string };
  footer?: { text: string };
  timestamp?: string;
}

export const COULEURS = { pepite: 0x2ecc71, promo: 0xe67e22, recherche: 0x3498db, info: 0x95a5a6 };

/** Discord accepte au plus 10 cartes par message. */
const PAR_MESSAGE = 10;

export function estWebhookDiscord(url: string | undefined): url is string {
  return Boolean(url && /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url));
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Coupe un texte trop long pour Discord (titre 256 caractères, description 4096). */
export function couper(t: string, max: number): string {
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

/** Envoie les cartes par paquets de 10 ; respecte l'attente demandée par Discord s'il freine (code 429). */
export async function envoyerDiscord(
  webhook: string,
  cartes: Carte[],
  contenu?: string,
  chercher: typeof fetch = fetch,
): Promise<void> {
  const paquets: Carte[][] = [];
  for (let i = 0; i < cartes.length; i += PAR_MESSAGE) paquets.push(cartes.slice(i, i + PAR_MESSAGE));
  if (!paquets.length) paquets.push([]);
  for (const [i, embeds] of paquets.entries()) {
    const corps = JSON.stringify({ username: "Bonnes Affaires", content: i === 0 ? contenu : undefined, embeds });
    for (let essai = 0; ; essai++) {
      const rep = await chercher(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: corps });
      if (rep.ok) break;
      if (rep.status === 429 && essai < 3) {
        const info = (await rep.json().catch(() => ({}))) as { retry_after?: number };
        await attendre(Math.ceil((info.retry_after ?? 2) * 1000));
        continue;
      }
      throw new Error(`Discord : envoi refusé (${rep.status})${rep.status === 404 ? " — webhook supprimé ?" : ""}`);
    }
    if (i < paquets.length - 1) await attendre(1000);
  }
}
