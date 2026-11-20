// Rayan's Bonnes Affaires — bot Discord. Un passage (lancé toutes les 5 minutes par planifier-bot.ps1) :
//   1. lit les bons plans Dealabs (flux officiels : Amazon, Cdiscount, Fnac, Darty…) ;
//   2. interroge eBay par son API officielle, si les clés sont dans reglages.json ;
//   3. lit une recherche Vinted et une Leboncoin, à tour de rôle (robot prudent, voir robot.ts) ;
//   4. envoie sur le salon Discord ce qui répond à mes recherches ou est une grosse promo, jamais deux fois.
//   node src/bot.ts            un passage
//   node src/bot.ts --essai    affiche ce qui serait envoyé, sans rien envoyer ni retenir
// Le tout premier passage n'envoie que « bot en marche » : il retient l'existant pour ne pas inonder le salon.
// De même, la première lecture d'une recherche sur un site (Vinted, Leboncoin, eBay) est retenue sans envoi.
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
import { flammes, grandePhoto, styleDe } from "./style.ts";
import { chargerReglages } from "./reglages.ts";
import { chargerEtat, enregistrerEtat, passageRobot, type EtatRobot, type SiteRobot } from "./robot.ts";

/** Ce qui part sur Discord : la carte, le lien qui sert à ne jamais l'envoyer deux fois, et si c'est une
 *  « dinguerie » (on tague tout le monde). */
export interface Alerte {
  lien: string;
  carte: Carte;
  dingue: boolean;
  /** Nom de la boutique ou du site (Amazon, eBay…). */
  boutique: string;
  /** Première lecture de cette recherche sur ce site : retenue sans envoi. */
  silencieux?: boolean;
}

const euros = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " €";
const pct = (x: number) => `−${Math.round(x * 100)} %`;
const champ = (name: string, value: string, inline = true) => ({ name, value, inline });

/** Pourquoi un bon plan Dealabs part : le nom de ma recherche, « grosse promo », ou rien. */
export function motifBonPlan(b: BonPlan, reglages: Reglages): string | undefined {
  const r = rattacher({ site: b.site, titre: b.titre, prix: b.prix ?? 0, port: null, lien: b.lien, livrable: true, remiseEnMain: false }, reglages.recherches);
  // Un bon plan déjà « froid » (votes négatifs) n'est pas envoyé : la communauté le juge mauvais ou expiré.
  if (r && b.degres >= 0 && !estExclue(b.titre, r.exclure) && !(r.prixMax && b.prix && b.prix > r.prixMax)) return r.nom;
  if (estDingue(b, reglages)) return "grosse promo";
  const d = reglages.discord;
  if (d?.grossesPromos === false) return undefined;
  if (b.degres >= (d?.degresMin ?? 300)) return "grosse promo";
  if (b.degres >= 0 && b.reduction && b.reduction >= (d?.reductionMin ?? 0.5)) return "grosse promo";
  return undefined;
}

/** Une dinguerie : bon plan brûlant (1000° et plus), ou énorme réduction déjà validée par la communauté. */
export function estDingue(b: BonPlan, reglages: Reglages): boolean {
  const d = reglages.discord;
  if (b.degres >= (d?.dingueDegres ?? 1000)) return true;
  return b.degres >= 100 && Boolean(b.reduction && b.reduction >= (d?.dingueReduction ?? 0.7));
}

export function carteBonPlan(b: BonPlan, motif: string, dingue = false): Carte {
  const s = styleDe(b.marchand);
  const champs = [];
  if (b.prix !== undefined) champs.push(champ("💶 Prix", `**${b.prix ? euros(b.prix) : "GRATUIT"}**`));
  if (b.prixHabituel && b.reduction) {
    champs.push(champ("🏷️ Avant", `~~${euros(b.prixHabituel)}~~`), champ("📉 Réduction", `**${pct(b.reduction)}**`));
  }
  champs.push(champ("🗳️ Votes", flammes(b.degres)));
  if (b.categorie) champs.push(champ("🗂️ Rayon", b.categorie));
  return {
    author: { name: `${s.emoji}  ${s.nom.toUpperCase()}` },
    title: couper(`${dingue ? "🚨 " : ""}${b.titre}`, 256),
    url: b.lien,
    description: dingue ? "🚨 **DINGUERIE** — fonce avant la rupture" : motif === "grosse promo" ? "📣 **Grosse promo**" : `🔎 Ma recherche · **${motif}**`,
    fields: champs,
    color: dingue ? COULEURS.dingue : s.couleur,
    image: b.photo ? { url: grandePhoto(b.photo)! } : undefined,
    footer: { text: "Dealabs · bons plans votés par la communauté" },
    timestamp: b.date && !Number.isNaN(b.date.getTime()) ? b.date.toISOString() : undefined,
  };
}

/** Une offre d'occasion part si elle n'inspire pas méfiance, reste dans la zone et vaut vraiment le coup :
 *  au moins `ecartOccasion` (40 %) sous son prix habituel et `gainOccasion` (15 €) à la revente. Les pépites, toujours. */
export function offreAEnvoyer(o: Offre, reglages?: Reglages): boolean {
  if (o.pepite) return true;
  const d = reglages?.discord;
  return o.surete !== "méfiance" && !o.loin && o.ecartPct >= (d?.ecartOccasion ?? 0.4) && o.gainRevente >= (d?.gainOccasion ?? 15);
}

/** Dinguerie d'occasion : pépite sûre, ou moitié prix « à vérifier » qui rapporte quand même gros à la revente. */
export function offreDingue(o: Offre, reglages: Reglages): boolean {
  return o.pepite || (o.surete !== "méfiance" && o.ecartPct >= 0.5 && o.gainRevente >= reglages.gainPepite);
}

/** Carte d'une annonce d'occasion (eBay aujourd'hui ; Vinted, Leboncoin… s'ils arrivent un jour). */
export function carteOffre(o: Offre, dingue = o.pepite): Carte {
  const s = styleDe(o.site);
  const lieu = [o.distanceKm != null && `📍 ${Math.round(o.distanceKm)} km${o.procheDe ? ` de ${o.procheDe}` : ""}`, o.livrable ? "📦 livrable" : "🤝 main propre"].filter(Boolean).join("\n");
  const avis = `${o.surete === "sûr" ? "✅" : o.surete === "à vérifier" ? "⚠️" : "⛔"} ${o.surete}`;
  return {
    author: { name: `${s.emoji}  ${s.nom.toUpperCase()}${o.etat ? ` · ${o.etat}` : ""}` },
    title: couper(`${dingue ? "🚨 " : ""}${o.titre}`, 256),
    url: o.lien,
    description: dingue
      ? `🚨 **DINGUERIE** — ${o.pepite ? "pépite sûre" : "moitié prix, à vérifier vite"} · ${o.recherche}`
      : `🔎 Ma recherche · **${o.recherche}**`,
    fields: [
      champ("💶 Prix", `**${euros(o.total)}**${o.port ? `\ndont ${euros(o.port)} de port` : ""}`),
      champ("🏷️ Habituel", `~~${euros(o.prixHabituel)}~~`),
      champ("📉 Réduction", `**${pct(o.ecartPct)}**`),
      champ("💰 Revente", `+${euros(Math.round(o.gainRevente))}`),
      champ("🚚 Retrait", lieu),
      champ("🛡️ Avis", avis),
      ...(o.raisons.length ? [champ("Pourquoi", couper(o.raisons.slice(0, 4).join(" · "), 1024), false)] : []),
    ],
    color: dingue ? COULEURS.dingue : s.couleur,
    image: o.photo ? { url: o.photo } : undefined,
    footer: { text: `${s.nom} · prix habituel : ${o.originePrix}` },
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

/** Annonces d'occasion : eBay (toutes mes recherches) et le robot Vinted / Leboncoin (une recherche par site),
 *  classées ensemble ; rend les alertes et les messages du robot (pause, reprise). */
async function alertesOccasion(reglages: Reglages, racine: string, etat: EtatRobot): Promise<{ alertes: Alerte[]; messages: string[] }> {
  const annonces: Annonce[] = [];
  const lues: string[] = [];
  const cles = reglages.ebay;
  if (cles?.clientId && cles.clientSecret) {
    try {
      const jeton = await jetonEbay(cles.clientId, cles.clientSecret);
      for (const r of reglages.recherches) {
        try {
          annonces.push(...(await chercherEbay(r, jeton, reglages.domiciles[0]?.codePostal)));
          lues.push(`eBay|${r.nom}`);
        } catch (e) {
          console.warn((e as Error).message);
        }
      }
    } catch (e) {
      console.warn((e as Error).message);
    }
  }
  const ro = reglages.robot ?? {};
  const sites: SiteRobot[] = [];
  if (ro.vinted !== false) sites.push("Vinted");
  // Leboncoin demande une vérification aux programmes (constaté le 20/11/2026) : coupé sauf si on l'active.
  if (ro.leboncoin === true) sites.push("Leboncoin");
  const robot = await passageRobot(reglages.recherches, etat, { sites, nuitDebut: ro.nuitDebut ?? 1, nuitFin: ro.nuitFin ?? 7, parPassage: ro.parPassage });
  annonces.push(...robot.annonces);
  lues.push(...robot.lues);

  if (annonces.length && reglages.domiciles.length) {
    await calculerDistances(annonces, reglages.domiciles, new Geocodeur(join(racine, "resultats", "cache-geo.json")));
  }
  const amorcees = new Set(etat.amorces);
  const alertes = classer(annonces, reglages)
    .filter((o) => offreAEnvoyer(o, reglages))
    .map((o) => ({
      lien: o.lien,
      carte: carteOffre(o, offreDingue(o, reglages)),
      dingue: offreDingue(o, reglages),
      boutique: styleDe(o.site).nom,
      silencieux: !amorcees.has(`${o.site}|${o.recherche}`),
    }));
  for (const l of lues) amorcees.add(l);
  etat.amorces = [...amorcees];
  return { alertes, messages: robot.messages };
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
      if (!motif) continue;
      const dingue = estDingue(b, reglages);
      alertes.push({ lien: b.lien, carte: carteBonPlan(b, motif, dingue), dingue, boutique: styleDe(b.marchand).nom });
    }
    console.log(`Dealabs : ${plans.length} bons plans lus, ${alertes.length} retenus`);
  } catch (e) {
    console.warn((e as Error).message);
  }
  const fichierEtat = join(racine, "resultats", "bot-etat.json");
  const etat = chargerEtat(fichierEtat);
  let messages: string[] = [];
  try {
    const occasion = await alertesOccasion(reglages, racine, etat);
    console.log(`Occasion : ${occasion.alertes.length} offres retenues (${occasion.alertes.filter((a) => a.silencieux).length} en première lecture, sans envoi)`);
    alertes.push(...occasion.alertes);
    messages = occasion.messages;
  } catch (e) {
    console.warn((e as Error).message);
  }

  const vus = new DejaVus(join(racine, "resultats", "bot-deja-vus.json"));
  // Un bon plan déjà envoyé qui devient une dinguerie (ses votes montent) repart une fois, avec le tag.
  const cle = (a: Alerte) => (a.dingue ? "dinguerie " : "") + a.lien;
  const nouvelles = alertes.filter((a) => !vus.a(cle(a)));
  if (essai) {
    for (const a of nouvelles) {
      const champs = (a.carte.fields ?? []).map((f) => `${f.name} ${f.value.replace(/\n/g, " ")}`).join(" | ");
      console.log(`${a.silencieux ? "(1re lecture) " : ""}${a.dingue ? "🚨 @everyone " : "• "}[${a.boutique}] ${a.carte.title}\n  ${a.carte.description}\n  ${champs}\n  ${a.lien}`);
    }
    for (const m of messages) console.log(`ℹ️ ${m}`);
    console.log(`(essai : ${nouvelles.filter((a) => !a.silencieux).length} seraient envoyées, rien n'est envoyé ni retenu)`);
    return;
  }
  if (vus.nouveau) {
    await envoyerDiscord(webhook!, [{
      title: "✅ Bot Bonnes Affaires en marche",
      description: `Je regarde Dealabs${reglages.ebay?.clientId ? ", eBay" : ""}${reglages.robot?.vinted === false ? "" : ", Vinted"}${reglages.robot?.leboncoin === true ? ", Leboncoin" : ""} toutes les 5 minutes et je poste ici chaque nouvelle affaire : ${reglages.recherches.map((r) => r.nom).join(", ")}${reglages.discord?.grossesPromos === false ? "" : ", plus les grosses promos"}.`,
      color: COULEURS.info,
    }]);
    console.log(`Premier passage : ${nouvelles.length} affaires déjà en ligne retenues sans envoi.`);
  } else {
    if (messages.length) {
      await envoyerDiscord(webhook!, messages.map((m) => ({ title: couper(m, 256), color: COULEURS.info })));
    }
    const aEnvoyer = nouvelles.filter((x) => !x.silencieux);
    // Chaque dinguerie part seule, avec @everyone ; le reste part en paquets, sans tag.
    for (const a of aEnvoyer.filter((x) => x.dingue)) {
      await envoyerDiscord(webhook!, [a.carte], `@everyone 🚨 **DINGUERIE** chez ${a.boutique} !`, fetch, true);
    }
    const calmes = aEnvoyer.filter((x) => !x.dingue);
    if (calmes.length) await envoyerDiscord(webhook!, calmes.map((a) => a.carte));
    if (aEnvoyer.length) console.log(`Discord : ${aEnvoyer.length} envoyées, dont ${aEnvoyer.length - calmes.length} dingueries (@everyone)`);
  }
  for (const a of nouvelles) {
    vus.retenir(cle(a));
    vus.retenir(a.lien);
  }
  vus.enregistrer();
  enregistrerEtat(fichierEtat, etat);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
