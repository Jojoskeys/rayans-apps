// Lecture automatique des mails : faux serveur IMAP local (aucun réseau), puis application directe des changements.
import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { expediteur, lireMails, quoted, tester } from "../src/main/imap-client.ts";
import { parseIcs } from "../src/core/ics.ts";
import { parseMailInput } from "../src/core/mail.ts";
import { addMail, appliquerAutomatiquement, applyFetch, displayCourses, EMPTY_FAC } from "../src/core/fac.ts";

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();
const ev = (uid: string, start: string, end: string, summary: string, loc: string) =>
  `BEGIN:VEVENT\r\nDTSTAMP:20261116T080000Z\r\nDTSTART:${start}\r\nDTEND:${end}\r\nSUMMARY:${summary}\r\nLOCATION:${loc}\r\nUID:${uid}\r\nEND:VEVENT\r\n`;
const ICS = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${ev("ADE60-1", "20261117T091500Z", "20261117T111500Z", "TD Analyse", "B12")}END:VCALENDAR\r\n`;

const MAIL_PROF = ["From: Secrétariat L3 Informatique <secretariat-l3info@univ-rennes.fr>", "To: rayan@etudiant.univ-rennes.fr",
  "Subject: Changement de salle", "Date: Mon, 16 Nov 2026 18:00:00 +0100", "Content-Type: text/plain; charset=utf-8", "",
  "Bonjour,", "Le TD d'analyse de ce mardi 17 novembre à 10h15 aura lieu en salle 004 du bâtiment 14 au lieu de la salle B12.", ""].join("\r\n");
const PUB = ["From: promo@exemple.test", "Subject: Soldes", "", "Rien à voir.", ""].join("\r\n");

/** Faux serveur IMAP : deux mails, vérifie que la boîte est ouverte en lecture seule et que rien n'est modifié. */
function fauxServeur(motDePasse: string) {
  const commandes: string[] = [];
  const boite = [{ uid: 41, src: PUB }, { uid: 42, src: MAIL_PROF }];
  const serveur = net.createServer((s) => {
    s.write("* OK IMAP pret\r\n");
    let buf = "";
    s.on("data", (d) => {
      buf += d.toString("utf8");
      let i;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const l = buf.slice(0, i); buf = buf.slice(i + 2);
        const [tag, ...reste] = l.split(" ");
        const cmd = reste.join(" ");
        commandes.push(cmd.startsWith("LOGIN") ? "LOGIN ***" : cmd);
        if (cmd.startsWith("LOGIN")) s.write(cmd.includes(quoted(motDePasse)) ? `${tag} OK connecte\r\n` : `${tag} NO [AUTHENTICATIONFAILED] mauvais mot de passe\r\n`);
        else if (cmd === "EXAMINE INBOX") s.write(`* ${boite.length} EXISTS\r\n* OK [UIDVALIDITY 777] ok\r\n${tag} OK [READ-ONLY] ouvert\r\n`);
        else if (cmd.startsWith("UID SEARCH")) s.write(`* SEARCH ${boite.map((m) => m.uid).join(" ")}\r\n${tag} OK\r\n`);
        else if (cmd.includes("HEADER.FIELDS")) {
          for (const m of boite) { const h = m.src.split("\r\n")[0] + "\r\n\r\n"; s.write(`* ${m.uid} FETCH (UID ${m.uid} RFC822.SIZE ${Buffer.byteLength(m.src)} BODY[HEADER.FIELDS (FROM)] {${Buffer.byteLength(h)}}\r\n${h})\r\n`); }
          s.write(`${tag} OK\r\n`);
        } else if (cmd.startsWith("UID FETCH")) {
          const uid = Number(/UID FETCH (\d+)/.exec(cmd)![1]);
          const m = boite.find((x) => x.uid === uid)!;
          s.write(`* 1 FETCH (UID ${uid} BODY[] {${Buffer.byteLength(m.src)}}\r\n${m.src})\r\n${tag} OK\r\n`);
        } else if (cmd === "LOGOUT") { s.write(`* BYE\r\n${tag} OK\r\n`); s.end(); }
        else s.write(`${tag} BAD inconnu\r\n`);
      }
    });
  });
  return new Promise<{ port: number; commandes: string[]; fermer: () => void }>((ok) => serveur.listen(0, "127.0.0.1", () => ok({ port: (serveur.address() as net.AddressInfo).port, commandes, fermer: () => serveur.close() })));
}

test("lecture IMAP : boîte en lecture seule, seuls les mails des profs sont téléchargés", async () => {
  const srv = await fauxServeur("mot de passe \"secret\"");
  try {
    const cfg = { host: "127.0.0.1", port: srv.port, user: "rayan", password: "mot de passe \"secret\"", insecure: true };
    assert.equal(await tester(cfg), 2);
    const r = await lireMails(cfg, at(10, 0), (a) => a.endsWith("@univ-rennes.fr"), new Set());
    assert.equal(r.uidValidity, "777");
    assert.deepEqual(r.mails.map((m) => m.uid), [42]);
    assert.equal(r.ignores, 1);
    assert.match(r.mails[0].source, /salle 004/);
    // Déjà vu : rien de plus.
    assert.equal((await lireMails(cfg, at(10, 0), () => true, new Set([41, 42]))).mails.length, 0);
    // Lecture seule : jamais SELECT, STORE, COPY, MOVE, EXPUNGE ; les corps sont lus avec PEEK (restent non lus).
    assert.ok(!srv.commandes.some((c) => /^(SELECT|STORE|COPY|MOVE|EXPUNGE|UID STORE|UID MOVE|UID COPY)/.test(c)), srv.commandes.join(" | "));
    assert.ok(srv.commandes.filter((c) => c.startsWith("UID FETCH")).every((c) => c.includes("PEEK")));
    // Mauvais mot de passe : message clair.
    await assert.rejects(tester({ ...cfg, password: "faux" }), /connexion refusée/);
  } finally { srv.fermer(); }
});

test("mail d'un prof autorisé : changement de salle appliqué directement ; expéditeur inconnu : à valider", () => {
  assert.equal(expediteur("From: =?utf-8?Q?Secr=C3=A9tariat?=\r\n <Secretariat-L3info@univ-rennes.fr>"), "secretariat-l3info@univ-rennes.fr");
  let d = applyFetch({ ...EMPTY_FAC, allowedSenders: ["@univ-rennes.fr"] }, parseIcs(ICS), at(16, 19));
  const ajout = addMail(d, parseMailInput(MAIL_PROF), at(16, 19));
  const r = appliquerAutomatiquement(ajout.data, ajout.mail.id);
  assert.equal(r.appliquees.length, 1);
  assert.equal(displayCourses(r.data)[0].room, "Salle 004 (bât. 14)");
  assert.ok(r.data.mails[0].auto);
  // Expéditeur hors liste : rien n'est appliqué.
  d = applyFetch({ ...EMPTY_FAC, allowedSenders: ["@autre.fr"] }, parseIcs(ICS), at(16, 19));
  const inconnu = addMail(d, parseMailInput(MAIL_PROF), at(16, 19));
  assert.equal(appliquerAutomatiquement(inconnu.data, inconnu.mail.id).appliquees.length, 0);
});
