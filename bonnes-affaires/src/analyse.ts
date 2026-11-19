// Avis sur chaque offre : est-ce sûr, et pourquoi.
// Les règles sont simples et expliquées à chaque fois (« + » rassure, « − » inquiète).
import type { Annonce, Recherche, Surete } from "./types.ts";

/** Protection acheteur quand on paie sur le site (et pas en dehors). */
const PROTECTIONS: [RegExp, string][] = [
  [/ebay/i, "Garantie client eBay"],
  [/vinted/i, "Protection acheteurs Vinted"],
  [/leboncoin/i, "paiement sécurisé Leboncoin"],
  [/back ?market/i, "garantie Back Market"],
  [/rakuten/i, "garantie Rakuten"],
];

export interface Analyse {
  surete: Surete;
  raisons: string[];
  score: number;
}

export function analyser(
  a: Annonce,
  ecartPct: number,
  categorie: Recherche["categorie"],
  originePrix: string,
  dansZone: boolean,
): Analyse {
  const plus: string[] = [];
  const moins: string[] = [];
  let niveau = 0; // 0 sûr, 1 à vérifier, 2 méfiance
  const monter = (n: number) => (niveau = Math.max(niveau, n));

  // Le prix
  // En main propre, on voit l'objet avant de payer : un prix très bas inquiète un cran de moins.
  if (dansZone && ecartPct > 0.75) {
    moins.push("Prix plus de 75 % sous l'habituel : vérifier sur place que ça marche et demander la facture (objet volé ?)");
    monter(1);
  } else if (dansZone && ecartPct > 0.55) {
    moins.push("Prix très bas : bien l'essayer sur place avant de payer");
  } else if (ecartPct > 0.75) {
    moins.push("Prix plus de 75 % sous l'habituel : arnaque, panne ou erreur sont fréquentes");
    monter(2);
  } else if (ecartPct > 0.55) {
    moins.push("Prix très bas : demander des photos récentes et une preuve que ça marche");
    monter(1);
  }
  const nb = /médiane de (\d+)/.exec(originePrix);
  if (nb && Number(nb[1]) < 8) moins.push(`Prix habituel estimé sur seulement ${nb[1]} annonces`);

  // Le lieu
  if (dansZone) {
    plus.push(`À ${a.distanceKm} km de ${a.procheDe} : on peut voir et essayer l'objet avant de payer`);
  } else if (!a.livrable && a.distanceKm == null) {
    moins.push("Lieu inconnu et pas de livraison : vérifier où il faut aller le chercher");
    monter(1);
  }

  // La livraison
  if (a.livrable && !dansZone) {
    const protection = PROTECTIONS.find(([re]) => re.test(a.site))?.[1];
    if (protection) plus.push(`Envoi protégé par la ${protection}, si on paie sur le site`);
    else if (/facebook/i.test(a.site)) {
      moins.push("Facebook à distance : aucune protection si on paie avant de recevoir");
      monter(2);
    }
    if (categorie === "electronique") moins.push("Électronique envoyée : impossible de l'essayer avant l'achat");
    if (a.port == null) {
      moins.push("Frais de port inconnus");
      monter(1);
    }
  }

  // Le vendeur (quand le site donne ses avis)
  const v = a.vendeur;
  if (v?.notePct != null && v.avis != null) {
    if (v.avis >= 5 && v.notePct < 90) {
      moins.push(`Vendeur mal noté (${v.notePct} % d'avis positifs)`);
      monter(2);
    } else if (v.avis < 5 || v.notePct < 97) {
      moins.push(`Vendeur peu connu ou moyen (${v.notePct} %, ${v.avis} avis)`);
      monter(1);
    } else {
      plus.push(`Vendeur bien noté (${v.notePct} %, ${v.avis} avis)`);
    }
  }

  const surete: Surete = (["sûr", "à vérifier", "méfiance"] as const)[niveau];
  // Au-delà de 60 % de remise, plus n'est pas mieux : c'est surtout plus suspect.
  const score =
    Math.min(ecartPct, 0.6) * 100 + (dansZone ? 15 : 0) - [0, 15, 50][niveau] - moins.length * 2;
  return { surete, raisons: [...plus.map((r) => `+ ${r}`), ...moins.map((r) => `− ${r}`)], score };
}
