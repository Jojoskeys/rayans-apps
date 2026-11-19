import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ajouterPapier, chercher, cheminPapier, extensionDe, extrait, lireIndex, renommerPapier, supprimerPapier, ErreurPapier } from "../src/core/papiers.ts";

const dossier = () => fs.mkdtempSync(path.join(os.tmpdir(), "papiers-"));
const papier = (id: string, titre: string, texte: string, ajoute: number) => ({ id, titre, ext: "jpg", texte, ajoute, taille: 10, ocr: "ok" });

test("ajout, recherche sans accents, plus récents d'abord", () => {
  const d = dossier();
  ajouterPapier(d, papier("a1", "Attestation CAF", "Caisse d'allocations familiales\nMontant mensuel : 210 €", 1));
  ajouterPapier(d, papier("b2", "Carte grise", "Certificat d'immatriculation\nDate de première immatriculation", 2));
  assert.deepEqual(chercher(lireIndex(d), "").map((r) => r.id), ["b2", "a1"]);
  assert.deepEqual(chercher(lireIndex(d), "premiere IMMATRICULATION").map((r) => r.id), ["b2"]);
  assert.deepEqual(chercher(lireIndex(d), "caf montant").map((r) => r.id), ["a1"]);
  assert.deepEqual(chercher(lireIndex(d), "caf carte"), []);
});

test("titre nettoyé, titre vide remplacé, id refusé s'il est dangereux", () => {
  const d = dossier();
  assert.equal(ajouterPapier(d, papier("c3", "  Facture\n  EDF  ", "", 1)).titre, "Facture EDF");
  assert.equal(ajouterPapier(d, papier("c4", "   ", "", 1)).titre, "Document sans titre");
  assert.throws(() => ajouterPapier(d, papier("../x", "t", "", 1)), ErreurPapier);
  assert.throws(() => ajouterPapier(d, { ...papier("c5", "t", "", 1), ext: "exe" }), ErreurPapier);
});

test("renommer et supprimer (la photo part avec)", () => {
  const d = dossier();
  ajouterPapier(d, papier("d1", "Avant", "", 1));
  fs.writeFileSync(cheminPapier(d, { id: "d1", ext: "jpg" }), "x");
  renommerPapier(d, "d1", "Après");
  assert.equal(lireIndex(d)[0].titre, "Après");
  supprimerPapier(d, "d1");
  assert.equal(lireIndex(d).length, 0);
  assert.equal(fs.existsSync(cheminPapier(d, { id: "d1", ext: "jpg" })), false);
  assert.throws(() => supprimerPapier(d, "d1"), (e: ErreurPapier) => e.code === 404);
});

test("types acceptés et extrait autour du mot cherché", () => {
  assert.equal(extensionDe("image/jpeg"), "jpg");
  assert.equal(extensionDe("image/HEIC"), "heic");
  assert.equal(extensionDe("application/pdf"), null);
  assert.equal(extensionDe(undefined), null);
  const long = "début ".repeat(40) + "numéro de sécurité sociale 1 23 45" + " fin".repeat(40);
  const e = extrait(long, ["securite"]);
  assert.ok(e.startsWith("…") && e.includes("sécurité sociale"));
  assert.equal(extrait("", ["x"]), "");
});
