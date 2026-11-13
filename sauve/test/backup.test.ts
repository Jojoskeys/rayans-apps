import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { ago, formatBytes, normalizeData, parseSummary, reminderNeeded, robocopyArgs, robocopyOk, safeName, targets, type Source } from "../src/core/backup.ts";

const src = (id: string, label: string, p: string, extra: Partial<Source> = {}): Source => ({ id, label, path: p, enabled: true, files: [], excludeDirs: [], preset: true, ...extra });
const PRESETS = [src("apps", "Données des apps", "C:/L/data"), src("documents", "Documents", "C:/U/Documents")];

test("réglages : sources proposées toujours à jour, sources ajoutées gardées", () => {
  const d = normalizeData({
    settings: {
      destination: " E:/ ", reminderDays: 500, mirror: "oui",
      sources: [
        { id: "apps", path: "ancien chemin", enabled: false, preset: true },
        { id: "x1", label: "Photos", path: "D:/Photos", preset: false, files: ["*.jpg", 3] },
        { id: "x2", label: "Vide", path: " ", preset: false },
      ],
    },
    history: [{ at: 1, ok: true }, { nimporte: "quoi" }],
  }, PRESETS);
  assert.equal(d.settings.destination, "E:/");
  assert.equal(d.settings.reminderDays, 7);
  assert.equal(d.settings.mirror, false);
  assert.deepEqual(d.settings.sources.map((s) => [s.id, s.path, s.enabled]), [["apps", "C:/L/data", false], ["documents", "C:/U/Documents", true], ["x1", "D:/Photos", true]]);
  assert.deepEqual(d.settings.sources[2].files, ["*.jpg"]);
  assert.equal(d.history.length, 1);
  assert.equal(normalizeData(null, PRESETS).settings.sources.length, 2);
});

test("noms des dossiers de sauvegarde", () => {
  assert.equal(safeName('Projet: "A/B" ?'), "Projet- -A-B- -");
  assert.equal(safeName("..."), "Dossier");
  const t = targets([src("a", "Photos", "x"), src("b", "photos", "y"), src("c", "Rayan's Hifz", "z")], "E:/", path.win32.join);
  assert.deepEqual([...t.values()], ["Photos", "photos (2)", "Rayan's Hifz"].map((n) => path.win32.join("E:/", "Sauvegarde Rayan", n)));
});

test("arguments robocopy", () => {
  const a = robocopyArgs(src("h", "Hifz", "C:/H", { files: ["hifz-donnees.json"], excludeDirs: ["Cache", "Code Cache"] }), "E:/S/Hifz", false);
  assert.deepEqual(a.slice(0, 4), ["C:/H", "E:/S/Hifz", "hifz-donnees.json", "/E"]);
  assert.ok(a.includes("/XJ") && a.includes("/FFT") && a.includes("/BYTES"));
  const xd = a.indexOf("/XD");
  assert.deepEqual(a.slice(xd + 1, xd + 3), ["Cache", "Code Cache"]);
  assert.ok(robocopyArgs(src("d", "D", "C:/D"), "E:/D", true).includes("/MIR"));
  assert.ok(!robocopyArgs(src("d", "D", "C:/D"), "E:/D", true).includes("/XD"));
  assert.ok(robocopyOk(0) && robocopyOk(1) && robocopyOk(3) && robocopyOk(7));
  assert.ok(!robocopyOk(8) && !robocopyOk(16) && !robocopyOk(null));
});

test("résumé robocopy en français et en anglais", () => {
  const fr = [
    "-------------------------------------------------------------------------------",
    "               Total     Copié    IgnoréDiscordance     ÉCHEC    Extras",
    "     Rép :         2         2         0         0         0         0",
    "Fichiers :        12         3         9         0         1         0",
    "  Octets :    123456      2048    121408         0         0         0",
    "   Heures:   0:00:00   0:00:00                       0:00:00   0:00:00",
    "   Débit :              18 000 Octets/sec.",
  ].join("\r\n");
  assert.deepEqual(parseSummary(fr), { dirs: [2, 2, 0, 0, 0, 0], files: [12, 3, 9, 0, 1, 0], bytes: [123456, 2048, 121408, 0, 0, 0] });
  const en = "    Dirs :         1         0         1         0         0         0\n   Files :         5         5         0         0         0         0\n   Bytes :       100       100         0         0         0         0\n";
  assert.deepEqual(parseSummary(en)!.files, [5, 5, 0, 0, 0, 0]);
  assert.equal(parseSummary("ERREUR 2 (0x00000002) Le fichier spécifié est introuvable."), null);
});

test("rappel : une fois par jour, après le délai, à partir de 10 h", () => {
  const at = (d: number, h: number) => new Date(2026, 10, d, h).getTime();
  const base = normalizeData({ settings: { destination: "E:/" }, history: [{ at: at(1, 12), ok: true }] }, PRESETS);
  assert.equal(reminderNeeded(base, at(7, 12)), false, "6 jours");
  assert.equal(reminderNeeded(base, at(8, 12)), true, "7 jours");
  assert.equal(reminderNeeded(base, at(8, 8)), false, "trop tôt le matin");
  assert.equal(reminderNeeded({ ...base, lastReminderDay: "2026-11-08" }, at(8, 15)), false, "déjà rappelé");
  assert.equal(reminderNeeded({ ...base, history: [...base.history, { ...base.history[0], at: at(6, 9), ok: false }] }, at(8, 12)), true, "un échec ne compte pas");
  assert.equal(reminderNeeded(normalizeData({ settings: { destination: "E:/" } }, PRESETS), at(8, 12)), true, "jamais sauvegardé");
  assert.equal(reminderNeeded(normalizeData({}, PRESETS), at(8, 12)), false, "pas de destination choisie");
});

test("affichage", () => {
  assert.equal(formatBytes(900), "900 o");
  assert.equal(formatBytes(1536), "1,5 Ko");
  assert.equal(formatBytes(5 * 1024 ** 3), "5,0 Go");
  const now = new Date(2026, 10, 13, 15).getTime();
  assert.equal(ago(null, now), "jamais");
  assert.equal(ago(new Date(2026, 10, 13, 9, 30).getTime(), now), "aujourd'hui à 09:30");
  assert.equal(ago(new Date(2026, 10, 12, 23, 0).getTime(), now), "hier à 23:00");
  assert.equal(ago(new Date(2026, 10, 3, 10).getTime(), now), "il y a 10 jours (3 novembre)");
});
