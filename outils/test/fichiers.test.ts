import { test } from "node:test";
import assert from "node:assert/strict";
import { elaguer, part, totaliser, type Dossier } from "../src/core/disque.ts";
import { dateDuTexte, nomLibre, nomPropre, proposerNom } from "../src/core/nommer.ts";
import { parse } from "../src/core/commands.ts";

const d = (nom: string, ici: number, enfants: Dossier[] = []): Dossier => ({ nom, chemin: `/${nom}`, taille: 0, fichiers: ici ? 1 : 0, enfants, ici });

test("disque : tailles additionnées de bas en haut, plus gros d'abord, petits dossiers écartés", () => {
  const arbre = totaliser(d("racine", 10, [d("petit", 5), d("gros", 100, [d("sous", 400)]), d("vide", 0)]));
  assert.equal(arbre.taille, 515);
  assert.equal(arbre.fichiers, 4);
  const e = elaguer(arbre, 1);
  assert.deepEqual(e.enfants.map((x) => x.nom), ["gros"]);
  assert.equal(e.enfants[0].taille, 500);
  assert.equal(part(500, 515), 97);
  assert.equal(part(1, 0), 0);
});

test("nommer : type, organisme et date trouvés dans le texte", () => {
  const p = proposerNom("CAISSE D'ALLOCATIONS FAMILIALES\nAttestation de paiement\nRennes, le 03/11/2026\nMontant : 210 €", ".PDF", 0);
  assert.equal(p?.nom, "Attestation CAF novembre 2026.pdf");
  assert.equal(proposerNom("FACTURE n° 4521\nEDF\nDate : 15 octobre 2026", ".jpg", 0)?.nom, "Facture EDF octobre 2026.jpg");
  assert.equal(proposerNom("Université de Rennes\nCertificat de scolarité\nAnnée 2026-2027", ".png", new Date(2026, 8, 5).getTime())?.nom, "Certificat de scolarité Université septembre 2026.png");
  assert.equal(proposerNom("Quittance de loyer\nPériode : mars 2026", ".pdf", 0)?.nom, "Quittance de loyer mars 2026.pdf");
});

test("nommer : sans mot connu, la première ligne qui ressemble à un titre ; sinon rien", () => {
  assert.equal(proposerNom("12 rue des Lilas 35000 Rennes\nCompte rendu de réunion\nblabla", ".pdf", 0)?.nom, "Compte rendu de réunion.pdf");
  assert.equal(proposerNom("", ".pdf", 0), null);
  assert.equal(proposerNom("1234 5678\n@@@", ".jpg", 0), null);
});

test("nommer : dates, caractères interdits, noms déjà pris", () => {
  assert.equal(dateDuTexte("le 5/2/26 à Rennes"), "février 2026");
  assert.equal(dateDuTexte("version 99/99/9999"), null);
  assert.equal(dateDuTexte("Fait en AOÛT 2025"), "août 2025");
  assert.equal(nomPropre('Facture: "EDF" / mars?. '), "Facture EDF mars");
  const pris = new Set(["Facture.pdf", "Facture (2).pdf"]);
  assert.equal(nomLibre("Facture.pdf", (n) => pris.has(n)), "Facture (3).pdf");
  assert.equal(nomLibre("Autre.pdf", (n) => pris.has(n)), "Autre.pdf");
});

test("commandes : disque, brut et nomme reconnus, avec leurs synonymes", () => {
  assert.deepEqual(parse("disque"), { tool: "disque" });
  assert.deepEqual(parse("place"), { tool: "disque" });
  assert.deepEqual(parse("brut"), { tool: "brut" });
  assert.deepEqual(parse("renommer"), { tool: "nomme" });
});
