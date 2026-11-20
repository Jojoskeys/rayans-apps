// Rayan's Bonnes Affaires — bot Discord. Un passage (lancé toutes les 5 minutes par planifier-bot.ps1) :
//   1. lit les bons plans Dealabs (flux officiels : Amazon, Cdiscount, Fnac, Darty…) ;
//   2. interroge eBay par son API officielle, si les clés sont dans reglages.json ;
//   3. envoie sur le salon Discord ce qui répond à mes recherches ou est une grosse promo, jamais deux fois.
//   node src/bot.ts            un passage
//   node src/bot.ts --essai    affiche ce qui serait envoyé, sans rien envoyer ni retenir
// Le tout premier passage n'envoie que « bot en marche » : il retient l'existant pour ne pas inonder le salon.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Annonce, Offre, Reglages } from "./types.ts";
import { chercherDealabs, type BonPlan } from "./dealabs.ts";
import { chercherEbay, jetonEbay } from "./ebay.ts";
import { classer, rattacher } from "./classement.ts";
import { estExclue } from "./texte.ts";
import { calculerDistances, Geocodeur } from "./distance.ts";
import { COULEURS, couper, envoyerDiscord, estWebhookDiscord, type Carte } from "./discord.ts";
import { chargerReglages } from "./reglages.ts";

/** Ce qui part sur Discord : la carte et le lien qui sert à ne jamais l'envoyer deux fois. */
export interface Alerte {
  lien: string;
  carte: Carte;
}

const euros = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " €";
const pct = (x: number) => `−${Math.round(x * 100)} %`;

/** Pourquoi un bon plan Dealabs part : le nom de ma recherche, « grosse promo », ou rien. */
export function motifBonPlan(b: BonPlan, reglages: Reglages): string | undefined {
  const r = rattacher({ site: b.site, titre: b.titre, prix: b.prix ?? 0, port: null, lien: b.lien, livrable: true, remiseEnMain: false }, reglages.recherches);
  // Un bon plan déjà « froid » (votes négatifs) n'est pas envoyé : la communauté le juge mauvais ou expiré.
  if (r && b.degres >= 0 && !estExclue(b.titre, r.exclure) && !(r.prixMax && b.prix && b.prix > r.prixMax)) return r.nom;
  const d = reglages.discord;
  if (d?.grossesPromos === false) return undefined;
  if (b.degres >= (d?.degresMin ?? 300)) return "grosse promo";
  if (b.degres >= 0 && b.reduction && b.reduction >= (d?.reductionMin ?? 0.5)) return "grosse promo";
  return undefined;
}

export function carteBonPlan(b: BonPlan, motif: string): Carte {
  const lignes: string[] = [];
  if (b.prix !== undefined) {
    let l = `💶 **${euros(b.prix)}**`;
    if (b.prixHabituel && b.reduction) l += ` au lieu de ${euros(b.prixHabituel)} (**${pct(b.reduction)}**)`;
    lignes.push(l);
  }
  lignes.push([b.marchand && `🏬 ${b.marchand}`, `🔥 ${b.degres}°`, b.categorie].filter(Boolean).join(" · "));
  lignes.push(motif === "grosse promo" ? "📣 Grosse promo" : `🔎 Ma recherche : ${motif}`);
  return {
    title: couper(b.titre, 256),
    url: b.lien,
    description: lignes.join("\n"),
    color: motif === "grosse promo" ? COULEURS.promo : COULEURS.recherche,
    thumbnail: b.photo ? { url: b.photo } : undefined,
    footer: { text: "Dealabs" },
    timestamp: b.date && !Number.isNaN(b.date.getTime()) ? b.date.toISOString() : undefined,
  };
}

/** Une offre eBay part si elle est sûre et assez sous son prix habituel (les pépites toujours). */
export function offreAEnvoyer(o: Offre): boolean {
  return o.pepite || (o.surete === "sûr" && !o.loin);
}

export function carteOffre(o: Offre): Carte {
  const lignes = [
    `💶 **${euros(o.total)}**${o.port ? ` (dont ${euros(o.port)} de port)` : ""} au lieu de ${euros(o.prixHabituel)} (**${pct(o.ecart)}**)`,
    `💰 Revente estimée : +${euros(Math.round(o.gainRevente))}`,
    [o.etat, o.distanceKm != null && `📍 ${Math.round(o.distanceKm)} km${o.procheDe ? ` de ${o.procheDe}` : ""}`, o.livrable ? "📦 livrable" : "🤝 main propre"].filter(Boolean).join(" · "),
    `${o.surete === "sûr" ? "✅" : o.surete === "à vérifier" ? "⚠️" : "⛔"} ${o.surete}${o.raisons.length ? " — " + o.raisons.slice(0, 3).join(", ") : ""}`,
    `🔎 Ma recherche : ${o.recherche}`,
  ];
  return {
    title: couper(`${o.pepite ? "💎 " : ""}${o.titre}`, 256),
    url: o.lien,
    description: couper(lignes.join("\n"), 4096),
    color: o.pepite ? COULEURS.pepite : COULEURS.recherche,
    thumbnail: o.photo ? { url: o.photo } : undefined,
    footer: { text: `${o.site} · prix habituel : ${o.originePrix}` },
  };
}

/** Liens déjà envoyés, avec leur date ; oubliés au bout de 60 jours. */
export class DejaVus {
  private vus: Record<string, number>;
  private fichier: string;
  readonly nouveau: boolean;
  constructor(fichier: string) {
    this.fichier = fichier;
    this.nouveau = !existsSync(fichier);
    this.vus = this.nouveau ? {} : JSON.parse(readFileSync(fichier, "utf8"));
  }
  a(lien: string) {
    return lien in this.vus;
  }
  retenir(lien: string, quand = Date.now()) {
    this.vus[lien] = quand;
  }
  enregistrer(quand = Date.now()) {
    const limite = quand - 60 * 24 * 3600 * 1000;
    for (const [l, t] of Object.entries(this.vus)) if (t < limite) delete this.vus[l];
    mkdirSync(dirname(this.fichier), { recursive: true });
    writeFileSync(this.fichier, JSON.stringify(this.vus));
  }
}

async function alertesEbay(reglages: Reglages, racine: string): Promise<Alerte[]> {
  const cles = reglages.ebay;
  if (!cles?.clientId || !cles.clientSecret) return [];
  const jeton = await jetonEbay(cles.clientId, cles.clientSecret);
  const annonces: Annonce[] = [];
  for (const r of reglages.recherches) {
    try {
      annonces.push(...(await chercherEbay(r, jeton, reglages.domiciles[0]?.codePostal)));
    } catch (e) {
      console.warn((e as Error).message);
    }
  }
  if (reglages.domiciles.length) {
    await calculerDistances(annonces, reglages.domiciles, new Geocodeur(join(racine, "resultats", "cache-geo.json")));
  }
  return classer(annonces, reglages)
    .filter(offreAEnvoyer)
    .map((o) => ({ lien: o.lien, carte: carteOffre(o) }));
}

async function main() {
  const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const essai = process.argv.includes("--essai");
  const reglages = chargerReglages(join(racine, "reglages.json"));
  const webhook = reglages.discord?.webhook;
  if (!essai && !estWebhookDiscord(webhook)) {
    console.error("Pas de webhook Discord valable dans reglages.json (« discord » → « webhook ») : rien n'est envoyé.");
    process.exit(1);
  }

  const alertes: Alerte[] = [];
  try {
    const plans = await chercherDealabs();
    for (const b of plans) {
      const motif = motifBonPlan(b, reglages);
      if (motif) alertes.push({ lien: b.lien, carte: carteBonPlan(b, motif) });
    }
    console.log(`Dealabs : ${plans.length} bons plans lus, ${alertes.length} retenus`);
  } catch (e) {
    console.warn((e as Error).message);
  }
  try {
    const ebay = await alertesEbay(reglages, racine);
    if (reglages.ebay?.clientId) console.log(`eBay : ${ebay.length} offres retenues`);
    alertes.push(...ebay);
  } catch (e) {
    console.warn((e as Error).message);
  }

  const vus = new DejaVus(join(racine, "resultats", "bot-deja-vus.json"));
  const nouvelles = alertes.filter((a) => !vus.a(a.lien));
  if (essai) {
    for (const a of nouvelles) console.log(`• ${a.carte.title}\n  ${a.carte.description?.replace(/\n/g, "\n  ")}\n  ${a.lien}`);
    console.log(`(essai : ${nouvelles.length} seraient envoyées, rien n'est envoyé)`);
    return;
  }
  if (vus.nouveau) {
    await envoyerDiscord(webhook!, [{
      title: "✅ Bot Bonnes Affaires en marche",
      description: `Je regarde Dealabs${reglages.ebay?.clientId ? " et eBay" : ""} toutes les 5 minutes et je poste ici chaque nouvelle affaire : ${reglages.recherches.map((r) => r.nom).join(", ")}${reglages.discord?.grossesPromos === false ? "" : ", plus les grosses promos"}.`,
      color: COULEURS.info,
    }]);
    console.log(`Premier passage : ${nouvelles.length} affaires déjà en ligne retenues sans envoi.`);
  } else if (nouvelles.length) {
    await envoyerDiscord(webhook!, nouvelles.map((a) => a.carte));
    console.log(`Discord : ${nouvelles.length} envoyées`);
  }
  for (const a of nouvelles) vus.retenir(a.lien);
  vus.enregistrer();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
