// Rayan's Bonnes Affaires — lancement :
//   npm start            recherche eBay (si clés) + fichiers du dossier imports/
//   npm run demo         classement d'exemple, sans réseau ni réglages
//   node src/main.ts --import fichier.csv   ajoute un fichier précis
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Annonce, Reglages } from "./types.ts";
import { classer } from "./classement.ts";
import { calculerDistances, Geocodeur } from "./distance.ts";
import { chercherEbay, jetonEbay } from "./ebay.ts";
import { lireDossier, lireFichier } from "./import.ts";
import { pageHtml, texteTerminal } from "./affichage.ts";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const demo = args.includes("--demo");

const DEFAUTS: Omit<Reglages, "recherches"> = { domiciles: [], distanceMaxKm: 30, ecartMin: 0.25, fraisRevente: 0.12, nombre: 20 };

function chargerReglages(): Reglages {
  const fichier = join(racine, demo ? "reglages.exemple.json" : "reglages.json");
  if (!existsSync(fichier)) {
    console.error("Pas de reglages.json : copiez reglages.exemple.json en reglages.json et remplissez-le.");
    process.exit(1);
  }
  const r: Reglages = { ...DEFAUTS, ...JSON.parse(readFileSync(fichier, "utf8")) };
  r.domiciles = r.domiciles.filter((d) => d.codePostal);
  if (!r.domiciles.length && r.codePostal) r.domiciles = [{ nom: "chez moi", codePostal: r.codePostal }];
  return r;
}

async function main() {
  const reglages = chargerReglages();
  const annonces: Annonce[] = [];

  if (demo) {
    annonces.push(...lireFichier(join(racine, "demo", "annonces-demo.json")));
  } else {
    const cles = reglages.ebay;
    if (cles?.clientId && cles.clientSecret) {
      const jeton = await jetonEbay(cles.clientId, cles.clientSecret);
      for (const r of reglages.recherches) {
        try {
          const trouvees = await chercherEbay(r, jeton, reglages.domiciles[0]?.codePostal);
          console.log(`eBay · ${r.nom} : ${trouvees.length} annonces`);
          annonces.push(...trouvees);
        } catch (e) {
          console.warn(String((e as Error).message));
        }
      }
    } else {
      console.log("eBay : pas de clés dans reglages.json, recherche eBay sautée.");
    }
    const importees = lireDossier(join(racine, "imports"));
    if (importees.length) console.log(`Dossier imports/ : ${importees.length} annonces`);
    annonces.push(...importees);
  }
  for (let i = args.indexOf("--import"); i >= 0; i = args.indexOf("--import", i + 1)) {
    if (args[i + 1]) annonces.push(...lireFichier(resolve(args[i + 1])));
  }

  if (reglages.domiciles.length) {
    await calculerDistances(annonces, reglages.domiciles, new Geocodeur(join(racine, "resultats", "cache-geo.json")));
  }

  const offres = classer(annonces, reglages);
  console.log("\n" + texteTerminal(offres, reglages.nombre));

  const sortie = join(racine, "resultats", "classement.html");
  mkdirSync(dirname(sortie), { recursive: true });
  writeFileSync(sortie, pageHtml(offres, new Date()));
  console.log(`\nPage complète : ${sortie}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
