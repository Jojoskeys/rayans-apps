// Vue du sport pour l'interface (PC et iPhone) : séance du jour avec son créneau, semaine, charges actuelles,
// allures de course, performances et dernières séances. Fonction pure.
import { todayISO } from "./counts.ts";
import { EXERCICES, type Exercice } from "./exercices.ts";
import {
  ALIAS, allures, creneau, DEPART, estimation5k, nomBloc, NOMS_SEANCES, prescriptions, SEANCES, seanceDuJour, SEMAINE,
  type Allures, type Occupation, type Perf, type Prescription, type SeanceDuJour, type SeanceFaite, type SportData,
} from "./sport.ts";

export interface SportView {
  aujourdhui: SeanceDuJour & { creneau: { debut: number; fin: number } | null; fiches: Record<string, Exercice> };
  semaine: { jour: string; titre: string; faite: boolean; creneau: { debut: number; fin: number } | null }[];
  charges: { bloc: string; nom: string; prescription: Prescription; depart: number; unite: string }[];
  allures: Allures;
  estimation: { secondes: number; source: string };
  perfs: Perf[];
  historique: SeanceFaite[];
}

const unite = (bloc: string) => {
  const e = EXERCICES[ALIAS[bloc] ?? bloc];
  return e?.mesure === "duree" ? "s" : e?.mesure === "lest" ? "kg de lest" : e?.mesure === "corps" ? "reps" : e?.parHaltere ? "kg par haltère" : "kg";
};

export function sportView(d: SportData, cours: Occupation[], now: number): SportView {
  const jour = todayISO(now);
  const s = seanceDuJour(d, jour, now);
  const fiches: Record<string, Exercice> = {};
  for (const b of s.blocs) fiches[b.ex] = EXERCICES[ALIAS[b.ex] ?? b.ex];
  // Semaine du lundi au dimanche.
  const [a, m, j] = jour.split("-").map(Number);
  const lundi = new Date(a, m - 1, j - ((new Date(a, m - 1, j).getDay() + 6) % 7), 12);
  const semaine = SEMAINE.map((_, i) => {
    const dj = todayISO(new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + i, 12).getTime());
    const x = seanceDuJour(d, dj, now);
    return { jour: dj, titre: x.course ? x.course.titre : NOMS_SEANCES[x.type], faite: !!x.faite, creneau: x.faite ? null : creneau(dj, x.dureeMin, cours, dj === jour ? now : undefined) };
  });
  const p = prescriptions(d);
  const blocs = [...new Set(Object.values(SEANCES).flat().map((b) => b.ex))].filter((b) => b !== "echauffement-epaule");
  return {
    aujourdhui: { ...s, creneau: s.faite ? null : creneau(jour, s.dureeMin, cours, now), fiches },
    semaine,
    charges: blocs.map((b) => ({ bloc: b, nom: nomBloc(b), prescription: p[b], depart: (EXERCICES[ALIAS[b] ?? b]?.mesure === "corps" || EXERCICES[ALIAS[b] ?? b]?.mesure === "duree") ? DEPART[b].reps : DEPART[b].charge, unite: unite(b) })),
    allures: allures(d, now),
    estimation: estimation5k(d, now),
    perfs: [...d.perfs].sort((x, y) => (y.jour ?? "") .localeCompare(x.jour ?? "")),
    historique: [...d.journal].reverse().slice(0, 30),
  };
}
