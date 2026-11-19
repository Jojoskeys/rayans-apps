// eBay : API officielle « Browse » (developer.ebay.com), autorisée et sans risque pour le compte.
// Il faut des clés de développeur gratuites (clientId / clientSecret) dans reglages.json.
// On ne fait que lire des annonces publiques : aucun achat, aucun message aux vendeurs.
import type { Annonce, Recherche } from "./types.ts";

const API = "https://api.ebay.com";

export async function jetonEbay(
  clientId: string,
  clientSecret: string,
  chercher: typeof fetch = fetch,
): Promise<string> {
  const rep = await chercher(`${API}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });
  if (!rep.ok) throw new Error(`eBay refuse les clés (${rep.status}). Vérifiez reglages.json.`);
  return ((await rep.json()) as { access_token: string }).access_token;
}

interface ResumeEbay {
  title: string;
  price?: { value: string; currency: string };
  itemWebUrl: string;
  condition?: string;
  image?: { imageUrl?: string };
  thumbnailImages?: { imageUrl?: string }[];
  seller?: { feedbackPercentage?: string; feedbackScore?: number };
  itemLocation?: { postalCode?: string; city?: string; country?: string };
  shippingOptions?: { shippingCostType?: string; shippingCost?: { value: string } }[];
}

/** Annonces d'occasion à prix fixe, situées en France, pour une recherche. */
export async function chercherEbay(
  r: Recherche,
  jeton: string,
  codePostal: string | undefined,
  chercher: typeof fetch = fetch,
): Promise<Annonce[]> {
  const filtres = ["itemLocationCountry:FR", "buyingOptions:{FIXED_PRICE}", "conditions:{USED}", "deliveryCountry:FR"];
  if (r.prixMax) filtres.push(`price:[..${r.prixMax}]`, "priceCurrency:EUR");
  const url = `${API}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(r.mots)}&limit=100&filter=${encodeURIComponent(filtres.join(","))}`;
  const contexte = `contextualLocation=${encodeURIComponent(`country=FR${codePostal ? `,zip=${codePostal}` : ""}`)}`;
  const rep = await chercher(url, {
    headers: {
      Authorization: `Bearer ${jeton}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_FR",
      "X-EBAY-C-ENDUSERCTX": contexte,
      "Accept-Language": "fr-FR",
    },
  });
  if (!rep.ok) throw new Error(`eBay : recherche « ${r.nom} » refusée (${rep.status})`);
  const donnees = (await rep.json()) as { itemSummaries?: ResumeEbay[] };
  return (donnees.itemSummaries ?? []).flatMap((i) => {
    if (i.price?.currency !== "EUR") return [];
    const livraison = i.shippingOptions?.[0];
    const port = livraison?.shippingCost ? Number(livraison.shippingCost.value) : null;
    return [
      {
        site: "eBay",
        titre: i.title,
        prix: Number(i.price.value),
        port,
        lien: i.itemWebUrl,
        recherche: r.nom,
        etat: i.condition,
        photo: i.image?.imageUrl ?? i.thumbnailImages?.[0]?.imageUrl,
        vendeur: i.seller
          ? { notePct: i.seller.feedbackPercentage ? Number(i.seller.feedbackPercentage) : undefined, avis: i.seller.feedbackScore }
          : undefined,
        codePostal: i.itemLocation?.postalCode,
        ville: i.itemLocation?.city,
        livrable: Boolean(livraison),
        remiseEnMain: !livraison,
      },
    ];
  });
}
