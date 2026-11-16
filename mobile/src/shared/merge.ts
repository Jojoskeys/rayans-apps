// Fusion à trois versions des données d'une app : base (dernière version synchronisée sur cet appareil), locale et
// distante (dépôt GitHub). Une révision faite sur le PC et une autre faite sur l'iPhone sont toutes les deux gardées ;
// un élément supprimé d'un côté (présent dans la base, absent d'un côté) est supprimé partout.
// Fonctions pures, partagées par la web app et par le pont de synchronisation du PC.

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
  chrono: mergeChrono,
  priere: mergeWhole,
  ouvertures: mergeOuvertures,
  "ouvertures-donnees": (_b, local, remote) => ((remote.publishedAt ?? 0) >= (local.publishedAt ?? 0) ? remote : local),
  fac: mergeFac,
};

/** Fusionne des textes JSON. Renvoie le texte fusionné. */
export function mergeText(app: string, base: string | null, local: string | null, remote: string | null): string | null {
  if (remote === null) return local;
  if (local === null) return remote;
  if (local === remote) return local;
  const m = MERGERS[app] ?? mergeWhole;
  return JSON.stringify(m(base ? JSON.parse(base) : undefined, JSON.parse(local), JSON.parse(remote)));
}
