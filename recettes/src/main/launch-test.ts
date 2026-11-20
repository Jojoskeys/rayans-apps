// Test de lancement (--test-lancement=<rapport.json>) : l'application démarre pour de vrai (paquet construit) sur
// un dossier Rayan's Favoris d'exemple (recettes inventées pour le test), on clique dans son interface, on vérifie
// la liste de courses et les données enregistrées, puis on écrit un rapport et on quitte.
// Tout se passe dans un dossier temporaire : les vraies données ne sont jamais touchées.
import { app, type BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { Donnees } from "../core/types.ts";

interface Hooks {
  getMain(): BrowserWindow | null;
  dataDir: string;
  getDonnees(): Donnees;
}

/** Crée un dossier Rayan's Favoris d'exemple et rend son chemin. */
export function exempleFavoris(dataDir: string): string {
  const d = path.join(dataDir, "Rayan's Favoris");
  fs.mkdirSync(path.join(d, "fiches"), { recursive: true });
  fs.writeFileSync(path.join(d, "recettes.md"), [
    "# Recettes de Rayan's Favoris", "",
    "## Omelette poulet épinards", "<!-- tiktok-1000000001 -->", "Source : https://www.tiktok.com/@_/video/1000000001 · 1 personne", "",
    "**Ingrédients**", "- 3 œufs", "- 100 g de blanc de poulet", "- 1 poignée d'épinards", "",
    "**Étapes**", "1. Battre les œufs", "2. Cuire le poulet 5 min", "3. Ajouter les œufs et les épinards, cuire 3 min", "",
  ].join("\n"));
  fs.writeFileSync(path.join(d, "fiches", "tiktok-1000000001.json"), JSON.stringify({
    id: "tiktok-1000000001", categorie: "recette", resume: "Omelette rapide au poulet.",
    pour_rayan: "Parfait pour ta sèche : beaucoup de protéines, peu de calories. Prends du poulet halal.",
    recette: { titre: "Omelette poulet épinards", portions: "1 personne", ingredients: ["3 œufs", "100 g de blanc de poulet", "1 poignée d'épinards"], etapes: ["Battre les œufs", "Cuire le poulet 5 min", "Ajouter les œufs et les épinards, cuire 3 min"] },
  }));
  fs.writeFileSync(path.join(d, "fiches", "instagram-Exemple1.json"), JSON.stringify({
    id: "instagram-Exemple1", categorie: "recette", resume: "Pancakes à la whey.",
    pour_rayan: "Bonne collation après la muscu. Vérifie que ta whey n'a pas de gélatine.",
    recette: { titre: "Pancakes à la whey", ingredients: ["2 œufs", "40 g de flocons d'avoine", "1 dose de whey"], etapes: ["Mixer", "Cuire à la poêle 2 min par face"] },
  }));
  fs.writeFileSync(path.join(d, "fiches", "tiktok-2.json"), JSON.stringify({ id: "tiktok-2", categorie: "utile", resume: "Pas une recette." }));
  return d;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor<T>(what: string, fn: () => T | Promise<T>, timeout = 20_000): Promise<T> {
  const t0 = Date.now();
  let last: unknown;
  while (Date.now() - t0 < timeout) {
    try { const v = await fn(); if (v) return v; } catch (e) { last = e; }
    await sleep(100);
  }
  throw new Error(`Délai dépassé : ${what}${last ? ` (${String(last)})` : ""}`);
}

export async function runLaunchTest(report: string, h: Hooks) {
  const r: Record<string, unknown> = { ok: false, uiLoaded: false, packaged: app.isPackaged, version: app.getVersion() };
  const fin = (code: number) => {
    try { fs.writeFileSync(report, JSON.stringify(r, null, 2)); } catch { /* rapport impossible */ }
    app.exit(code);
  };
  setTimeout(() => { r.erreur = "Délai global dépassé"; fin(1); }, 90_000);
  try {
    const w = (await waitFor("fenêtre", () => h.getMain()))!;
    const js = (code: string) => w.webContents.executeJavaScript(code, true);
    const click = (sel: string) => js(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return false; b.click(); return true; })()`);
    await waitFor("chargement", () => !w.webContents.isLoading());
    r.cartes = await waitFor("cartes de recettes", async () => {
      const n = await js(`document.querySelectorAll('[data-testid="carte-recette"]').length`);
      return n === 2 ? n : 0;
    });
    r.uiLoaded = true;
    r.remarques = await js(`document.querySelector('[data-testid="remarques"]')?.textContent ?? ""`);
    await waitFor("panier", () => click('[data-testid="panier"]'));
    await waitFor("je l'ai faite", () => click('[data-testid="faite"]'));
    await waitFor("onglet courses", () => click('[data-testid="nav-courses"]'));
    r.courses = await waitFor("liste de courses", async () => {
      const t: string = await js(`document.querySelector('[data-testid="liste-courses"]')?.textContent ?? ""`);
      return t.includes("œufs") || t.includes("oeufs") ? t : "";
    });
    // Plan de la semaine, puis la liste de courses du jour, regroupée par magasin.
    await waitFor("onglet plan", () => click('[data-testid="nav-plan"]'));
    await waitFor("créer le plan", () => click('[data-testid="generer-plan"]'));
    r.casesRemplies = await waitFor("cases du jour", async () => {
      const n: number = await js(`[...document.querySelectorAll('[data-testid="cases-jour"] select')].filter((s) => s.value).length`);
      return n >= 2 ? n : 0;
    });
    await waitFor("courses du jour", () => click('[data-testid="courses-du-jour"]'));
    await waitFor("par magasin", () => click('[data-testid="par-magasin"]'));
    r.coursesMagasins = await waitFor("liste par magasin", async () => {
      const t: string = await js(`document.querySelector('[data-testid="liste-courses"]')?.textContent ?? ""`);
      return /\b(À|Au|Sur) /.test(t) ? t : "";
    });
    const d = h.getDonnees();
    r.panier = d.panier;
    r.faites = Object.keys(d.faites);
    const fichier = JSON.parse(fs.readFileSync(path.join(h.dataDir, "recettes.json"), "utf8"));
    r.ok = d.panier.length === 1 && Object.keys(d.faites).length === 1 && fichier.panier.length === 1
      && fichier.plan?.jours?.length === 7;
    const captures = process.env.RECETTES_CAPTURES;
    if (captures) {
      fs.mkdirSync(captures, { recursive: true });
      w.setSize(1120, 760);
      w.show();
      await sleep(400);
      fs.writeFileSync(path.join(captures, "courses.png"), (await w.webContents.capturePage()).toPNG());
      await click('[data-testid="nav-plan"]');
      await sleep(400);
      fs.writeFileSync(path.join(captures, "plan.png"), (await w.webContents.capturePage()).toPNG());
      await click('[data-testid="nav-recettes"]');
      await sleep(400);
      fs.writeFileSync(path.join(captures, "recettes.png"), (await w.webContents.capturePage()).toPNG());
    }
    fin(r.ok ? 0 : 1);
  } catch (e) {
    r.erreur = String(e);
    fin(1);
  }
}
