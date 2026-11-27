// Fusion à trois versions des données d'une app : base (dernière version synchronisée sur cet appareil), locale et
// distante (dépôt GitHub). Une révision faite sur le PC et une autre faite sur l'iPhone sont toutes les deux gardées ;
// un élément supprimé d'un côté (présent dans la base, absent d'un côté) est supprimé partout.
// Fonctions pures, partagées par la web app et par le pont de synchronisation du PC.

import { mergeCourses, mergeMemos } from "./petites.ts";
import { fusionnerTexte } from "../../../memoire/src/core/model.ts";
import { fusionnerTexte as fusionnerSommeil } from "../../../sommeil/src/core/model.ts";
import { fusionnerTexte as fusionnerFocus } from "../../../focus/src/core/model.ts";
import { fusionnerTexte as fusionnerCalcul } from "../../../calcul/src/core/model.ts";
import { fusionnerTexte as fusionnerCalme } from "../../../calme/src/core/model.ts";
import { fusionnerTexte as fusionnerCulture } from "../../../culture/src/core/model.ts";

type Obj = Record<string, any>;

/** Fusion d'une collection identifiée par clé. `newer(a, b)` dit si a est plus récent que b. */
export function mergeById<T>(base: T[] | undefined, local: T[], remote: T[], key: (x: T) => string, newer: (a: T, b: T) => boolean): T[] {
  const b = new Map((base ?? []).map((x) => [key(x), x]));
  const l = new Map(local.map((x) => [key(x), x]));
  const r = new Map(remote.map((x) => [key(x), x]));
  const out: T[] = [];
  const seen = new Set<string>();
  for (const k of [...l.keys(), ...r.keys()]) {
    if (seen.has(k)) continue;
    seen.add(k);
    const lx = l.get(k), rx = r.get(k), bx = b.get(k);
    if (lx && rx) out.push(newer(rx, lx) ? rx : lx);
    else if (lx) { if (!bx || changed(bx, lx)) out.push(lx); } // absent à distance : supprimé là-bas, sauf si modifié ici
    else if (rx) { if (!bx || changed(bx, rx)) out.push(rx); }
  }
  return out;
}

/** Même chose pour un objet clé → valeur. */
export function mergeRecord<T>(base: Record<string, T> | undefined, local: Record<string, T>, remote: Record<string, T>, newer: (a: T, b: T) => boolean): Record<string, T> {
  const entries = mergeById(
    base ? Object.entries(base) : undefined, Object.entries(local ?? {}), Object.entries(remote ?? {}),
    (e) => e[0], (a, b) => newer(a[1], b[1]),
  );
  return Object.fromEntries(entries);
}

const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

/** Réglages : on garde la valeur modifiée par rapport à la base (la distante si les deux ont changé). */
export function mergeSettings<T extends Obj>(base: T | undefined, local: T, remote: T): T {
  if (!base) return { ...local, ...remote };
  const out: Obj = { ...remote };
  for (const k of Object.keys(local)) if (changed(local[k], base[k]) && !changed(remote[k], base[k])) out[k] = local[k];
  return out as T;
}

// ----- Rayan's Révision ------------------------------------------------------------------------------

export function mergeRevision(base: Obj | undefined, local: Obj, remote: Obj): Obj {
  const cardTime = (c: Obj) => Math.max(c.updated ?? 0, c.sched?.lastReview ?? 0);
  return {
    ...local,
    decks: mergeById(base?.decks, local.decks ?? [], remote.decks ?? [], (d: Obj) => d.id, (a, b) => changed(a, b) && (a.created ?? 0) >= (b.created ?? 0)),
    cards: mergeById(base?.cards, local.cards ?? [], remote.cards ?? [], (c: Obj) => c.id, (a, b) => cardTime(a) > cardTime(b)),
    // Le journal des révisions ne fait que grandir : union.
    reviews: unionBy(local.reviews ?? [], remote.reviews ?? [], (r: Obj) => `${r.cardId}|${r.ts}`).sort((a: Obj, b: Obj) => a.ts - b.ts),
    settings: mergeSettings(base?.settings, local.settings ?? {}, remote.settings ?? {}),
  };
}

// ----- Rayan's Hifz ----------------------------------------------------------------------------------

export function mergeHifz(base: Obj | undefined, local: Obj, remote: Obj): Obj {
  const cardNewer = (a: Obj, b: Obj) => (a.last ?? "") > (b.last ?? "") || ((a.last ?? "") === (b.last ?? "") && (a.reps ?? 0) > (b.reps ?? 0));
  const activity: Obj = { ...(remote.activity ?? {}) };
  for (const [day, v] of Object.entries<Obj>(local.activity ?? {})) {
    const r = activity[day];
    activity[day] = r ? { reviews: Math.max(r.reviews ?? 0, v.reviews ?? 0), memorized: Math.max(r.memorized ?? 0, v.memorized ?? 0) } : v;
  }
  return {
    ...local,
    verses: mergeRecord(base?.verses, local.verses ?? {}, remote.verses ?? {}, () => true),
    cards: mergeRecord(base?.cards, local.cards ?? {}, remote.cards ?? {}, cardNewer),
    activity,
    settings: mergeSettings(base?.settings, local.settings ?? {}, remote.settings ?? {}),
  };
}

// ----- Rayan's Aujourd'hui : routine -----------------------------------------------------------------

export function mergeRoutine(base: Obj | undefined, local: Obj, remote: Obj): Obj {
  const done: Obj = {};
  const days = new Set([...Object.keys(local.done ?? {}), ...Object.keys(remote.done ?? {})]);
  for (const d of days) {
    const ids = mergeById(
      (base?.done?.[d] ?? []) as string[], (local.done?.[d] ?? []) as string[], (remote.done?.[d] ?? []) as string[],
      (x) => x, () => false,
    );
    if (ids.length) done[d] = ids;
  }
  return {
    items: mergeById(base?.items, local.items ?? [], remote.items ?? [], (i: Obj) => i.id, (a, b) => changed(a, b) && a !== b),
    done,
    sent: unionBy(local.sent ?? [], remote.sent ?? [], (x: string) => x),
  };
}

// ----- Rayan's Aujourd'hui : objectifs du jour ----------------------------------------------------------
// Par journée : si un seul côté a changé la liste (objectif remplacé, case cochée), il l'emporte ; si les deux
// ont changé, la liste du côté qui l'a créée en premier est gardée, une case cochée d'un côté reste cochée, et un
// compteur (pas, pompes…) garde la plus grande valeur.

const memeJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function mergeObjectifs(base: Obj | undefined, local: Obj, remote: Obj): Obj {
  const jours: Obj = {};
  for (const j of new Set([...Object.keys(local.jours ?? {}), ...Object.keys(remote.jours ?? {})])) {
    const b = base?.jours?.[j], l = local.jours?.[j], r = remote.jours?.[j];
    if (!l || !r) { jours[j] = l ?? r; continue; }
    if (memeJson(l, r) || memeJson(b, r)) { jours[j] = l; continue; }
    if (memeJson(b, l)) { jours[j] = r; continue; }
    // Les deux ont changé : liste choisie de la même façon sur chaque appareil (pour que tous convergent),
    // et une case cochée d'un côté reste cochée.
    const cle = (x: Obj[]) => x.map((o) => o.id).join("|");
    const liste = (cle(l) <= cle(r) ? l : r) as Obj[];
    const faits = new Set([...l, ...r].filter((o: Obj) => o.fait).map((o: Obj) => o.id));
    const valeur = (o: Obj) => Math.max(...[...l, ...r].filter((x: Obj) => x.id === o.id && typeof x.valeur === "number").map((x: Obj) => x.valeur as number), -1);
    jours[j] = liste.map((o) => { const v = valeur(o); return { ...o, fait: !!o.fait || faits.has(o.id), ...(v >= 0 ? { valeur: v } : {}) }; });
  }
  return {
    jours,
    envoyes: unionBy(local.envoyes ?? [], remote.envoyes ?? [], (x: string) => x),
    reglages: mergeSettings(base?.reglages, local.reglages ?? {}, remote.reglages ?? {}),
  };
}

// ----- Rayan's Aujourd'hui : bilan et adhkar -------------------------------------------------------------
// Par jour : matin et soir, le plus récent l'emporte ; liste prévue réunie par id (case cochée d'un côté gardée) ;
// adhkar cochés réunis.

export function mergeBilan(base: Obj | undefined, local: Obj, remote: Obj): Obj {
  const jours: Obj = {};
  const recent = (a?: Obj, b?: Obj) => (!a ? b : !b ? a : (a.at ?? 0) >= (b.at ?? 0) ? a : b);
  for (const j of new Set([...Object.keys(local.jours ?? {}), ...Object.keys(remote.jours ?? {})])) {
    const b = base?.jours?.[j] ?? {}, l = local.jours?.[j] ?? {}, r = remote.jours?.[j] ?? {};
    const out: Obj = {};
    const matin = recent(l.matin, r.matin), soir = recent(l.soir, r.soir);
    if (matin) out.matin = matin;
    if (soir) out.soir = soir;
    if (l.prevu || r.prevu) {
      // La liste vient du dernier bilan du soir ; les cases cochées des deux côtés sont gardées.
      const textes = (x?: Obj[]) => JSON.stringify((x ?? []).map((p) => p.texte));
      const deuxChanges = !memeJson(b.prevu, r.prevu) && !memeJson(b.prevu, l.prevu);
      const liste: Obj[] = (deuxChanges ? (textes(l.prevu) <= textes(r.prevu) ? l.prevu ?? r.prevu : r.prevu ?? l.prevu) : memeJson(b.prevu, r.prevu) ? l.prevu : r.prevu) ?? [];
      const coches = (x?: Obj[]) => new Map((x ?? []).map((p) => [p.id, !!p.fait]));
      const lb = coches(b.prevu), ll = coches(l.prevu), lr = coches(r.prevu);
      out.prevu = liste.map((p) => {
        const a = ll.get(p.id), c = lr.get(p.id), o = lb.get(p.id);
        const fait = a !== undefined && a !== o ? a : c !== undefined && c !== o ? c : (a ?? c ?? p.fait);
        return { ...p, fait };
      });
    }
    // Adhkar : pour chaque moment, le côté qui a changé depuis la base l'emporte (coché ou décoché).
    const ad: Obj = {};
    for (const m of ["sabah", "masa"]) {
      const lv = l.adhkar?.[m], rv = r.adhkar?.[m], bv = b.adhkar?.[m];
      const v = lv !== bv ? lv : rv;
      if (v) ad[m] = v;
    }
    if (Object.keys(ad).length) out.adhkar = ad;
    jours[j] = out;
  }
  return {
    jours,
    envoyes: unionBy(local.envoyes ?? [], remote.envoyes ?? [], (x: string) => x),
    reglages: mergeSettings(base?.reglages, local.reglages ?? {}, remote.reglages ?? {}),
  };
}

// ----- Rayan's Aujourd'hui : sport ---------------------------------------------------------------------------
// Les charges sont recalculées à partir du journal : il suffit de réunir les journaux. Une même séance (même jour,
// même type) saisie des deux côtés : la plus récente l'emporte.

export function mergeSport(base: Obj | undefined, local: Obj, remote: Obj): Obj {
  const parSeance = new Map<string, Obj>();
  for (const s of [...(remote.journal ?? []), ...(local.journal ?? [])]) {
    const k = `${s.jour}|${s.type}`;
    const prev = parSeance.get(k);
    if (!prev || (s.at ?? 0) >= (prev.at ?? 0)) parSeance.set(k, s);
  }
  return {
    debut: local.debut ?? remote.debut,
    journal: [...parSeance.values()].sort((a, b) => (a.at ?? 0) - (b.at ?? 0)),
    perfs: mergeById(base?.perfs, local.perfs ?? [], remote.perfs ?? [], (p: Obj) => p.id, () => false),
    ajustements: unionBy(local.ajustements ?? [], remote.ajustements ?? [], (a: Obj) => a.id).sort((a: Obj, b: Obj) => a.at - b.at),
    // Réglages des exercices et programme de la semaine : la valeur modifiée depuis la base l'emporte.
    ...mergeSettings(
      base ? { reglages: base.reglages ?? {}, semaine: base.semaine ?? null } : undefined,
      { reglages: local.reglages ?? {}, semaine: local.semaine ?? null },
      { reglages: remote.reglages ?? {}, semaine: remote.semaine ?? null },
    ),
  };
}

// ----- Rayan's Chrono --------------------------------------------------------------------------------

export function mergeChrono(base: Obj | undefined, local: Obj, remote: Obj): Obj {
  const byCreated = (a: Obj, b: Obj) => changed(a, b);
  return {
    ...local,
    projects: mergeById(base?.projects, local.projects ?? [], remote.projects ?? [], (p: Obj) => p.id, byCreated),
    tasks: mergeById(base?.tasks, local.tasks ?? [], remote.tasks ?? [], (t: Obj) => t.id, byCreated),
    entries: mergeById(base?.entries, local.entries ?? [], remote.entries ?? [], (e: Obj) => e.id, (a, b) => (a.end ?? 0) > (b.end ?? 0)).sort((a: Obj, b: Obj) => a.start - b.start),
    settings: mergeSettings(base?.settings, local.settings ?? {}, remote.settings ?? {}),
    // Le minuteur en cours et la sélection restent propres à chaque appareil.
    timer: local.timer, selection: local.selection, ui: local.ui,
  };
}

// ----- Réglages seuls (Prière) et données en lecture seule sur l'iPhone ---------------------------------

export function mergeWhole(base: Obj | undefined, local: Obj, remote: Obj): Obj {
  return mergeSettings(base, local, remote);
}

// ----- Rayan's Ouvertures --------------------------------------------------------------------------------
// ouvertures.json : { joueur: { idExercice: état } } (réponses aux exercices, des deux côtés).
// ouvertures-donnees.json : exercices et répertoire calculés par le PC (Stockfish), en lecture seule ailleurs.

export function mergeOuvertures(base: Obj | undefined, local: Obj, remote: Obj): Obj {
  const out: Obj = {};
  for (const u of new Set([...Object.keys(local ?? {}), ...Object.keys(remote ?? {})])) {
    out[u] = mergeRecord(base?.[u], local?.[u] ?? {}, remote?.[u] ?? {}, (a: Obj, b: Obj) => (a.last ?? 0) > (b.last ?? 0));
  }
  return out;
}

// ----- Rayan's Aujourd'hui : fac ---------------------------------------------------------------------
// Le PC télécharge ADE (le serveur de la fac refuse les autres sites) : l'emploi du temps vient du côté qui l'a
// téléchargé le plus récemment. Mails partagés, corrections validées et échéances viennent des deux côtés.

export function mergeFac(base: Obj | undefined, local: Obj, remote: Obj): Obj {
  const ade = (remote.lastFetch ?? 0) >= (local.lastFetch ?? 0) ? remote : local;
  const pick = (o: Obj) => ({ icsUrl: o.icsUrl ?? "", groups: o.groups ?? [], allowedSenders: o.allowedSenders ?? [] });
  const mailNewer = (a: Obj, b: Obj) => (a.proposals ?? []).filter((p: Obj) => p.status !== "a-valider").length > (b.proposals ?? []).filter((p: Obj) => p.status !== "a-valider").length;
  return {
    ...pick(base ? mergeSettings(pick(base), pick(local), pick(remote)) : { ...pick(remote), ...pick(local) }),
    courses: ade.courses ?? [], changes: ade.changes ?? [], lastFetch: ade.lastFetch ?? 0, lastError: ade.lastError ?? null, availableGroups: ade.availableGroups ?? [],
    mails: mergeById(base?.mails, local.mails ?? [], remote.mails ?? [], (m: Obj) => m.id, mailNewer).sort((a: Obj, b: Obj) => b.addedAt - a.addedAt),
    overrides: mergeById(base?.overrides, local.overrides ?? [], remote.overrides ?? [], (o: Obj) => `${o.courseUid}|${o.kind}`, (a, b) => changed(a, b)),
    deadlines: mergeById(base?.deadlines, local.deadlines ?? [], remote.deadlines ?? [], (d: Obj) => d.id, (a, b) => changed(a, b)).sort((a: Obj, b: Obj) => a.at - b.at),
  };
}

function unionBy<T>(a: T[], b: T[], key: (x: T) => string): T[] {
  const m = new Map<string, T>();
  for (const x of [...a, ...b]) m.set(key(x), x);
  return [...m.values()];
}

export const MERGERS: Record<string, (base: Obj | undefined, local: Obj, remote: Obj) => Obj> = {
  revision: mergeRevision,
  hifz: mergeHifz,
  routine: mergeRoutine,
  objectifs: mergeObjectifs,
  bilan: mergeBilan,
  sport: mergeSport,
  chrono: mergeChrono,
  priere: mergeWhole,
  ouvertures: mergeOuvertures,
  "ouvertures-donnees": (_b, local, remote) => ((remote.publishedAt ?? 0) >= (local.publishedAt ?? 0) ? remote : local),
  fac: mergeFac,
  courses: (b, l, r) => mergeCourses(b as never, l as never, r as never),
  memos: (b, l, r) => mergeMemos(b as never, l as never, r as never),
  // Rayan's Mémoire : sa propre fusion (résultats et séances additionnés, palais et listes au plus récent).
  memoire: (_b, local, remote) => fusionnerTexte(local, remote) as unknown as Obj,
  // Les apps « pour progresser » : leur propre fusion, sur le texte JSON.
  sommeil: (_b, local, remote) => JSON.parse(fusionnerSommeil(JSON.stringify(local), JSON.stringify(remote))!) as Obj,
  focus: (_b, local, remote) => JSON.parse(fusionnerFocus(JSON.stringify(local), JSON.stringify(remote))!) as Obj,
  calcul: (_b, local, remote) => JSON.parse(fusionnerCalcul(JSON.stringify(local), JSON.stringify(remote))!) as Obj,
  calme: (_b, local, remote) => JSON.parse(fusionnerCalme(JSON.stringify(local), JSON.stringify(remote))!) as Obj,
  culture: (_b, local, remote) => JSON.parse(fusionnerCulture(JSON.stringify(local), JSON.stringify(remote))!) as Obj,
  // Abonnements aux notifications (un par appareil) et préférences.
  notifications: (base, local, remote) => ({
    subscriptions: mergeById(base?.subscriptions, local.subscriptions ?? [], remote.subscriptions ?? [], (x: Obj) => x.endpoint, () => false),
    prefs: mergeSettings(base?.prefs, local.prefs ?? {}, remote.prefs ?? {}),
  }),
};

/** Fusionne des textes JSON. Renvoie le texte fusionné. */
export function mergeText(app: string, base: string | null, local: string | null, remote: string | null): string | null {
  if (remote === null) return local;
  if (local === null) return remote;
  if (local === remote) return local;
  const m = MERGERS[app] ?? mergeWhole;
  return JSON.stringify(m(base ? JSON.parse(base) : undefined, JSON.parse(local), JSON.parse(remote)));
}
