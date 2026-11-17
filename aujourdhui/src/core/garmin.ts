// Montre Garmin (Forerunner 165) branchée au PC : les séances de Rayan's Muscu (tractions, pompes, répétitions par
// série) et les courses deviennent des séances du journal sport, comme si elles avaient été saisies.
// Rien de ce qui a déjà été saisi n'est remplacé : la saisie à la main l'emporte toujours.
import { todayISO } from "./counts.ts";
import { EPOQUE_FIT, type MessageFit } from "./fit.ts";
import { SEANCES, jourSemaine, semaineDe, type SeanceFaite, type SportData, type TypeSeance } from "./sport.ts";

export type ActiviteMontre =
  | { kind: "muscu"; fichier: string; debut: number; exercice: "tractions" | "pompes"; series: number[] }
  | { kind: "course"; fichier: string; debut: number; distanceKm: number; dureeS: number };

const COURSES: TypeSeance[] = ["fractionne", "seuil", "longue"];

/** Activité utile tirée d'un fichier FIT, ou null (vélo, marche, course de moins d'1 km, autre app…). */
export function activiteDepuisFit(fichier: string, msgs: MessageFit[]): ActiviteMontre | null {
  const s = msgs.find((m) => m.num === 18);
  if (!s || typeof s.champs[2] !== "number") return null;
  const debut = (s.champs[2] + EPOQUE_FIT) * 1000;
  const sport = s.champs[5];
  if (sport === 1) {
    const dist = s.champs[9], timer = s.champs[8];
    if (typeof dist !== "number" || typeof timer !== "number") return null;
    const distanceKm = Math.round(dist / 1000) / 100; // centimètres → km, au centième
    const dureeS = Math.round(timer / 1000);
    if (distanceKm < 1 || dureeS < 300) return null;
    return { kind: "course", fichier, debut, distanceKm, dureeS };
  }
  if (sport === 10) {
    const nom = String(s.champs[110] ?? msgs.find((m) => m.num === 12)?.champs[3] ?? "").toLowerCase();
    const exercice = nom.startsWith("traction") ? "tractions" : nom.startsWith("pompe") ? "pompes" : null;
    const circuits = msgs.filter((m) => m.num === 19 && typeof m.dev.repetitions === "number");
    if (!exercice || !circuits.length) return null;
    const series = circuits.map((m) => m.dev.repetitions as number).filter((n) => n > 0);
    return series.length ? { kind: "muscu", fichier, debut, exercice, series } : null;
  }
  return null;
}

/** Séance du programme qui contient cet exercice (tirage pour les tractions strictes, poussée pour les pompes en volume…). */
const typeDuBloc = (bloc: string) => (Object.keys(SEANCES) as (keyof typeof SEANCES)[]).find((t) => SEANCES[t].some((b) => b.ex === bloc))!;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/**
 * Ajoute les activités de la montre au journal. Une activité antérieure au début du plan est ignorée.
 * Muscu : dans la séance du jour prévue si elle contient l'exercice, sinon dans celle qui le contient (tirage,
 * poussée) ; ignorée si l'exercice a déjà des séries ce jour-là. Course : dans la course prévue ce jour-là
 * (sinon « sortie longue ») ; ignorée si une course y est déjà notée.
 */
export function importerMontre(d: SportData, acts: ActiviteMontre[]): { data: SportData; ajouts: string[] } {
  let journal = [...d.journal];
  const ajouts: string[] = [];
  for (const a of [...acts].sort((x, y) => x.debut - y.debut)) {
    const jour = todayISO(a.debut);
    if (jour < d.debut) continue;
    const prevu = semaineDe(d)[jourSemaine(jour)];
    if (a.kind === "muscu") {
      const bloc = a.exercice === "tractions" ? "tractions-strictes" : prevu === "upper" ? "pompes" : "pompes-volume";
      const type: TypeSeance = prevu in SEANCES && SEANCES[prevu as keyof typeof SEANCES].some((b) => b.ex === bloc) ? prevu : typeDuBloc(bloc);
      const i = journal.findIndex((s) => s.jour === jour && s.type === type);
      const ancienne = i >= 0 ? journal[i] : null;
      if (ancienne?.exercices.some((e) => e.bloc === bloc && e.series.length)) continue;
      const exo = { bloc, series: a.series.map((reps) => ({ charge: 0, reps })) };
      const seance: SeanceFaite = ancienne
        ? { ...ancienne, exercices: [...ancienne.exercices.filter((e) => e.bloc !== bloc), exo] }
        : { id: `montre-${a.debut}`, jour, type, exercices: [exo], note: "Importée de la montre", at: a.debut };
      journal = i >= 0 ? journal.map((s, k) => (k === i ? seance : s)) : [...journal, seance];
      ajouts.push(`${a.exercice === "tractions" ? "Tractions" : "Pompes"} : ${a.series.join(" · ")}`);
    } else {
      const type: TypeSeance = COURSES.includes(prevu) ? prevu : "longue";
      const i = journal.findIndex((s) => s.jour === jour && s.type === type);
      const ancienne = i >= 0 ? journal[i] : null;
      if (ancienne?.course) continue;
      const course = { distanceKm: a.distanceKm, dureeS: a.dureeS, ressenti: "correct" as const };
      const seance: SeanceFaite = ancienne
        ? { ...ancienne, course }
        : { id: `montre-${a.debut}`, jour, type, exercices: [], course, note: "Importée de la montre", at: a.debut };
      journal = i >= 0 ? journal.map((s, k) => (k === i ? seance : s)) : [...journal, seance];
      ajouts.push(`Course : ${String(a.distanceKm).replace(".", ",")} km en ${mmss(a.dureeS)}`);
    }
  }
  return { data: { ...d, journal: journal.sort((x, y) => x.at - y.at) }, ajouts };
}
