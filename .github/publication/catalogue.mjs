#!/usr/bin/env node
// Publication des applications dans Rayan's Launcher (voir launcher/README.md, « Publication automatique »).
// Aucune dépendance : Node 20+, `gh` (GitHub CLI) et `hangar-tools` pour la sous-commande « construire ».
//
//   node catalogue.mjs entree --manifest <rayans-launcher.json> --zip <app.zip> --repo <owner/repo>
//                             --icon <fichier> [--image <fichier>] --dest <dossier> [--notes-out <fichier>]
//       Vérifie la fiche, calcule SHA-256 et taille, prépare dans <dest> les fichiers de la release
//       (ZIP, visuels, rayans-launcher-entree.json). Écrit id=, version=, tag=, name= sur la sortie standard.
//
//   node catalogue.mjs construire --repo <owner/repo> --tools <hangar-tools> --catalog-url <url>
//                                 --out <dossier> [--keep 3]
//       Lit toutes les releases <id>-v<x.y.z>, garde la plus récente valide de chaque application, écrit
//       <out>/catalog.json et la liste des anciennes releases à supprimer dans <out>/a-supprimer.txt.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ENTRY_ASSET = "rayans-launcher-entree.json";
export const CATALOG_TITLE = "Le catalogue de Rayan";
const ID_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const TAG_RE = /^([a-z0-9][a-z0-9_-]{1,63})-v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/;
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

export const tagFor = (id, version) => `${id}-v${version}`;

/** « analyse-echecs-v1.0.205 » → { id: "analyse-echecs", version: "1.0.205" } ; null si ce n'est pas un tag d'app. */
export function parseTag(tag) {
  const m = TAG_RE.exec(tag);
  return m ? { id: m[1], version: m[2] } : null;
}

export function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** Erreurs de la fiche rayans-launcher.json (tableau vide si elle est complète). */
export function checkManifest(m) {
  const errors = [];
  if (!m || typeof m !== "object" || Array.isArray(m)) return ["la fiche n'est pas un objet JSON"];
  if (typeof m.id !== "string" || !ID_RE.test(m.id)) errors.push(`id « ${m.id} » invalide (2 à 64 caractères a-z 0-9 - _)`);
  for (const k of ["name", "description", "releaseNotes"]) {
    if (typeof m[k] !== "string" || !m[k].trim()) errors.push(`champ « ${k} » manquant`);
  }
  if (typeof m.version !== "string" || !VERSION_RE.test(m.version)) errors.push(`version « ${m.version} » invalide (MAJEUR.MINEUR.CORRECTIF)`);
  const exe = m.executable;
  if (typeof exe !== "string" || !exe.toLowerCase().endsWith(".exe")) {
    errors.push(`executable « ${exe} » invalide (chemin relatif d'un .exe dans le ZIP)`);
  } else if (/^[\\/]|^[a-zA-Z]:|(^|[\\/])\.\.([\\/]|$)/.test(exe)) {
    errors.push(`executable « ${exe} » doit être un chemin relatif sans « .. »`);
  }
  return errors;
}

export function assetUrl(repo, tag, name) {
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;
}

/** Entrée du catalogue, avec des adresses absolues vers les fichiers de la release. */
export function buildEntry(m, { repo, zipName, sha256, size, iconName, imageName, date }) {
  const tag = tagFor(m.id, m.version);
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    icon: assetUrl(repo, tag, iconName),
    image: assetUrl(repo, tag, imageName),
    version: m.version,
    releaseNotes: m.releaseNotes,
    releaseDate: date,
    downloadUrl: assetUrl(repo, tag, zipName),
    sha256,
    size,
    executable: m.executable,
  };
}

/** Releases d'applications, par id, de la plus récente à la plus ancienne (brouillons et autres releases ignorés). */
export function candidates(releases) {
  const byId = new Map();
  for (const r of releases) {
    const t = parseTag(r.tag);
    if (!t || r.draft || !(r.assets || []).includes(ENTRY_ASSET)) continue;
    if (!byId.has(t.id)) byId.set(t.id, []);
    byId.get(t.id).push({ tag: r.tag, version: t.version });
  }
  for (const list of byId.values()) list.sort((a, b) => compareVersions(b.version, a.version));
  return byId;
}

/** Texte exact du catalogue (c'est ce texte qui est signé). Ordre stable : par nom, puis par id. */
export function assemble(entries, title = CATALOG_TITLE) {
  const apps = [...entries].sort((a, b) => a.name.localeCompare(b.name, "fr") || a.id.localeCompare(b.id));
  return JSON.stringify({ schemaVersion: 1, title, apps }, null, 2) + "\n";
}

/** Anciennes releases à supprimer : on garde les `keep` plus récentes de chaque app, et toujours celle du catalogue. */
export function toPrune(byId, chosenTags, keep) {
  const out = [];
  for (const list of byId.values()) {
    list.forEach((c, i) => {
      if (i >= keep && !chosenTags.has(c.tag)) out.push(c.tag);
    });
  }
  return out;
}

// ----- Ligne de commande ---------------------------------------------------------------------------

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) throw new Error(`argument inattendu « ${argv[i]} »`);
    o[argv[i].slice(2)] = argv[++i];
  }
  return o;
}

function need(o, k) {
  if (!o[k]) throw new Error(`option --${k} manquante`);
  return o[k];
}

function sha256File(file) {
  const h = createHash("sha256");
  const fd = fs.openSync(file, "r");
  const buf = Buffer.alloc(1 << 20);
  try {
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return h.digest("hex");
}

function imageExt(file, what) {
  const ext = path.extname(file).toLowerCase();
  if (!IMAGE_EXT.has(ext)) throw new Error(`${what} « ${file} » : format non pris en charge (PNG, JPEG, GIF, WebP ou SVG)`);
  if (fs.statSync(file).size > 6 * 1024 * 1024) throw new Error(`${what} « ${file} » dépasse 6 Mo`);
  return ext === ".jpeg" ? ".jpg" : ext;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
}

function cmdEntree(o) {
  const manifest = readJson(need(o, "manifest"));
  const errors = checkManifest(manifest);
  if (errors.length) throw new Error(`fiche rayans-launcher.json incomplète :\n  - ${errors.join("\n  - ")}`);
  const zip = need(o, "zip");
  const repo = need(o, "repo");
  const dest = need(o, "dest");
  const icon = need(o, "icon");
  const image = o.image || icon;
  fs.mkdirSync(dest, { recursive: true });
  const zipName = `${manifest.id}-${manifest.version}.zip`;
  const iconName = `icone${imageExt(icon, "icône")}`;
  const imageName = `image${imageExt(image, "image")}`;
  fs.copyFileSync(zip, path.join(dest, zipName));
  fs.copyFileSync(icon, path.join(dest, iconName));
  fs.copyFileSync(image, path.join(dest, imageName));
  const entry = buildEntry(manifest, {
    repo,
    zipName,
    sha256: sha256File(zip),
    size: fs.statSync(zip).size,
    iconName,
    imageName,
    date: new Date().toISOString().slice(0, 10),
  });
  fs.writeFileSync(path.join(dest, ENTRY_ASSET), JSON.stringify(entry, null, 2) + "\n");
  if (o["notes-out"]) {
    fs.writeFileSync(o["notes-out"], `${manifest.releaseNotes}\n\nSHA-256 du ZIP : \`${entry.sha256}\`\n`);
  }
  const tag = tagFor(manifest.id, manifest.version);
  process.stdout.write(`id=${manifest.id}\nversion=${manifest.version}\ntag=${tag}\nname=${manifest.name.replace(/[\r\n]+/g, " ")}\n`);
}

function gh(argv, opts = {}) {
  return execFileSync("gh", argv, { encoding: "utf8", maxBuffer: 64 << 20, ...opts });
}

function listReleases(repo) {
  const out = gh(["api", `repos/${repo}/releases`, "--paginate", "--jq", ".[] | {tag: .tag_name, draft: .draft, assets: [.assets[].name]}"]);
  return out.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

/** Contrôle une entrée seule avec les règles du launcher de distribution (hangar-tools validate --strict). */
function validateEntry(tools, entry, catalogUrl, tmp) {
  const f = path.join(tmp, `${entry.id}-seul.json`);
  fs.writeFileSync(f, assemble([entry]));
  try {
    execFileSync(tools, ["validate", f, "--strict", "--base-url", catalogUrl], { encoding: "utf8", stdio: "pipe" });
    return null;
  } catch (e) {
    return (e.stderr || e.stdout || e.message).toString().trim();
  }
}

/**
 * Choisit, pour chaque application, la release la plus récente dont l'entrée est lisible et valide.
 * `fetchEntry(tag)` renvoie l'entrée (objet) ou lève une erreur ; `validate(entry)` renvoie null ou un message.
 */
export function build(releases, { fetchEntry, validate, keep = 3, log = console.log }) {
  const byId = candidates(releases);
  const entries = [];
  const chosen = new Set();
  for (const [id, list] of byId) {
    for (const c of list) {
      let entry;
      try {
        entry = fetchEntry(c.tag);
      } catch (e) {
        log(`::warning title=${id}::${c.tag} : fiche illisible (${String(e.stderr || e.message).trim()}), version précédente essayée.`);
        continue;
      }
      const err =
        entry?.id !== id || entry?.version !== c.version
          ? `la fiche annonce ${entry?.id} ${entry?.version}`
          : validate(entry);
      if (err) {
        log(`::warning title=${id}::${c.tag} refusée : ${err.replace(/\r?\n/g, " ")}. Version précédente essayée.`);
        continue;
      }
      entries.push(entry);
      chosen.add(c.tag);
      log(`${id} ${c.version} (${c.tag})`);
      break;
    }
  }
  return { text: assemble(entries), count: entries.length, prune: toPrune(byId, chosen, keep) };
}

function cmdConstruire(o) {
  const repo = need(o, "repo");
  const tools = need(o, "tools");
  const catalogUrl = need(o, "catalog-url");
  const out = need(o, "out");
  fs.mkdirSync(out, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "catalogue-"));
  const r = build(listReleases(repo), {
    keep: Number(o.keep || 3),
    fetchEntry: (tag) => {
      const dir = path.join(tmp, tag);
      gh(["release", "download", tag, "--repo", repo, "--pattern", ENTRY_ASSET, "--dir", dir, "--clobber"], { stdio: "pipe" });
      return readJson(path.join(dir, ENTRY_ASSET));
    },
    validate: (entry) => validateEntry(tools, entry, catalogUrl, tmp),
  });
  fs.writeFileSync(path.join(out, "catalog.json"), r.text);
  fs.writeFileSync(path.join(out, "a-supprimer.txt"), r.prune.map((t) => t + "\n").join(""));
  console.log(`Catalogue : ${r.count} application(s). Anciennes releases à supprimer : ${r.prune.length}.`);
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const o = args(rest);
  if (cmd === "entree") return cmdEntree(o);
  if (cmd === "construire") return cmdConstruire(o);
  throw new Error(`commande inconnue « ${cmd ?? ""} » (entree ou construire)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error(`::error::${e.message}`);
    process.exit(1);
  }
}
