import { test } from "node:test";
import assert from "node:assert/strict";
import { aRemplir, BILAN_VIDE, cocherAdhkar, cocherPrevu, moments, nettoyerBilan, notificationsBilan, noterMatin, noterSoir, reglerBilan, type BilanData, type Prieres } from "../src/core/bilan.ts";
import { heuresDePriere } from "../src/core/prieres.ts";
import { CITATIONS, citationsDuJour, formater } from "../src/core/citations.ts";

// Mardi 17 novembre 2026, heures de prière fictives proches de Rennes.
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();
const prieres = (d = 17): Prieres => ({ fajr: at(d, 6, 40), lever: at(d, 8, 25), asr: at(d, 14, 45), maghrib: at(d, 17, 20) });

function envoyer(d: BilanData, now: number, p: Prieres | null = prieres()) {
  const r = notificationsBilan(d, now, p);
  return { d: r.data, titres: r.messages.map((m) => m.titre), corps: r.messages.map((m) => m.corps).join("\n") };
}

test("rappel du matin après Fajr avec les adhkar as-sabâh, une seule fois", () => {
  let d = BILAN_VIDE;
  assert.deepEqual(envoyer(d, at(17, 6, 45)).titres, []);
  const r = envoyer(d, at(17, 6, 51));
  assert.deepEqual(r.titres, ["Bonjour : début de journée"]);
  assert.match(r.corps, /Adhkar as-sabâh \(avant le lever du soleil, 08 h 25\)/);
  assert.match(r.corps, /Comment tu te sens aujourd'hui/);
  d = r.d;
  assert.deepEqual(envoyer(d, at(17, 7, 30)).titres, []);
  // PC allumé à 10 h 30 : trop tard pour le rappel d'après Fajr (plus de 3 h après) ; la citation de 8 h part encore.
  assert.deepEqual(envoyer(BILAN_VIDE, at(17, 10, 30)).titres, ["Citation du jour ☀️"]);
  // Sans heures de prière : à 7 h.
  assert.deepEqual(envoyer(BILAN_VIDE, at(17, 7, 1), null).titres, ["Bonjour : début de journée"]);
});

test("adhkar al-masâ' entre Asr et Maghrib, dernier rappel juste avant Maghrib s'ils ne sont pas faits", () => {
  let d = BILAN_VIDE;
  const m = moments(d, at(17, 12), prieres());
  assert.equal(m.masa, at(17, 16, 40)); // 40 min avant Maghrib
  assert.deepEqual(envoyer(d, at(17, 16, 30)).titres, []);
  let r = envoyer(d, at(17, 16, 41));
  assert.deepEqual(r.titres, ["Adhkar al-masâ'"]);
  assert.match(r.corps, /Maghrib à 17 h 20/);
  d = r.d;
  r = envoyer(d, at(17, 17, 11));
  assert.deepEqual(r.titres, ["Adhkar al-masâ' : dernier rappel"]);
  // Faits entre-temps : pas de dernier rappel.
  const fait = cocherAdhkar(envoyer(BILAN_VIDE, at(17, 16, 41)).d, at(17, 16, 50), "masa");
  assert.deepEqual(envoyer(fait, at(17, 17, 11)).titres, []);
  // En été, Asr tardif : jamais avant Asr + 5 min.
  const ete: Prieres = { fajr: at(17, 4), lever: at(17, 6), asr: at(17, 18, 30), maghrib: at(17, 18, 50) };
  assert.equal(moments(BILAN_VIDE, at(17, 12), ete).masa, at(17, 18, 35));
});

test("bilan du soir à 17 h 30, puis la liste pour demain devient la liste du lendemain", () => {
  let d = BILAN_VIDE;
  let r = envoyer(d, at(17, 17, 31));
  assert.ok(r.titres.includes("Bilan du soir"));
  d = r.d;
  assert.ok(aRemplir(d, at(17, 17, 31), prieres()).soir);
  d = noterSoir(d, at(17, 21), 4, "Bonne journée, TD réussi.", "Fatigué mais content 🙂", ["Réviser l'analyse", "  ", "Appeler maman"]);
  assert.equal(d.jours["2026-11-17"].soir!.journee, "Bonne journée, TD réussi.");
  assert.ok(!aRemplir(d, at(17, 21, 5), prieres()).soir);
  assert.deepEqual(d.jours["2026-11-18"].prevu!.map((p) => p.texte), ["Réviser l'analyse", "Appeler maman"]);
  // Le lendemain matin : la liste apparaît dans la notification, et se coche.
  r = envoyer(d, at(18, 6, 52), prieres(18));
  assert.match(r.corps, /Prévu hier soir : Réviser l'analyse · Appeler maman/);
  d = cocherPrevu(r.d, at(18, 9), d.jours["2026-11-18"].prevu![0].id);
  assert.equal(d.jours["2026-11-18"].prevu![0].fait, true);
  // Modifier le bilan du soir garde ce qui était déjà coché.
  const d2 = noterSoir(d, at(17, 22), 4, "", "", ["Réviser l'analyse", "Appeler maman", "Courses"]);
  assert.equal(d2.jours["2026-11-18"].prevu!.length, 3);
});

test("ressenti du matin, réglages et relecture du fichier", () => {
  let d = noterMatin(BILAN_VIDE, at(17, 7), 3, "Un peu fatigué, mais motivé.");
  assert.equal(d.jours["2026-11-17"].matin!.ressenti, "Un peu fatigué, mais motivé.");
  assert.throws(() => noterMatin(BILAN_VIDE, at(17, 7), 0, "x"));
  // Matin déjà noté : la notification ne parle plus que des adhkar.
  assert.doesNotMatch(envoyer(d, at(17, 6, 51)).corps, /Comment tu te sens/);
  d = cocherAdhkar(d, at(17, 7, 5), "sabah");
  assert.ok(d.jours["2026-11-17"].adhkar!.sabah);
  d = reglerBilan(d, { soirH: 18, soirM: 0, avantMaghrib: 30 });
  assert.equal(moments(d, at(17, 12), prieres()).soir, at(17, 18));
  assert.deepEqual(nettoyerBilan(JSON.parse(JSON.stringify(d))), d);
  // Bilan désactivé, adhkar gardés.
  const seulsAdhkar = reglerBilan(BILAN_VIDE, { actif: false });
  assert.deepEqual(envoyer(seulsAdhkar, at(17, 17, 31)).titres, []);
  assert.match(envoyer(seulsAdhkar, at(17, 6, 51)).corps, /Adhkar as-sabâh/);
});

test("heures de prière calculées comme Rayan's Prière (Rennes, UOIF)", () => {
  const p = heuresDePriere({ version: 1, settings: { place: { name: "Rennes", lat: 48.1173, lng: -1.6778, tz: "Europe/Paris" }, method: "uoif", asr: "shafii", highLat: "angle" } }, at(17, 12))!;
  const hm = (ms: number) => new Date(ms).toTimeString().slice(0, 5);
  assert.ok(p.fajr < p.lever && p.lever < p.asr && p.asr < p.maghrib);
  // Ordres de grandeur pour Rennes mi-novembre.
  assert.ok(hm(p.fajr) >= "06:00" && hm(p.fajr) <= "07:30", hm(p.fajr));
  assert.ok(hm(p.maghrib) >= "16:50" && hm(p.maghrib) <= "17:45", hm(p.maghrib));
  assert.equal(heuresDePriere({ settings: {} }, at(17, 12)), null);
});

test("citations du jour : une le matin, une à midi, différentes, sans répétition avant d'avoir tout vu", () => {
  let d = BILAN_VIDE;
  // Rappel d'après Fajr déjà parti : à 8 h, seule la citation.
  d = envoyer(d, at(17, 6, 51)).d;
  let r = envoyer(d, at(17, 8, 1));
  assert.deepEqual(r.titres, ["Citation du jour ☀️"]);
  const c = citationsDuJour("2026-11-17");
  assert.equal(r.corps, formater(c.matin));
  d = r.d;
  assert.deepEqual(envoyer(d, at(17, 9)).titres, []);
  r = envoyer(d, at(17, 12, 31));
  assert.deepEqual(r.titres, ["Pour bien continuer la journée"]);
  assert.notEqual(c.matin.texte, c.midi.texte);
  assert.deepEqual(citationsDuJour("2026-11-17"), c, "même jour, mêmes citations");
  // Sur toute une série de jours, chaque citation du matin revient seulement après que les autres sont passées.
  const matins = CITATIONS.filter((x) => x.moment !== "midi").length;
  // Un cycle complet commence au jour n tel que n % matins === 0 (n = jours depuis 1970).
  const debut = Math.ceil(Date.UTC(2026, 0, 1) / 86_400_000 / matins) * matins;
  const vus = new Set<string>();
  for (let i = 0; i < matins; i++) vus.add(citationsDuJour(new Date((debut + i) * 86_400_000).toISOString().slice(0, 10)).matin.texte);
  assert.equal(vus.size, matins);
  // Chaque hadith a sa référence.
  assert.ok(CITATIONS.filter((x) => x.genre === "hadith").every((x) => x.source && x.auteur === "Le Prophète ﷺ"));
  // Désactivées : rien.
  assert.deepEqual(envoyer(reglerBilan(BILAN_VIDE, { citations: false, actif: false, adhkar: false }), at(17, 8, 1)).titres, []);
});
