// Vue du sport pour l'interface (PC et iPhone) : séance du jour avec son créneau, semaine, charges actuelles,
// allures de course, performances et dernières séances. Fonction pure.
import { todayISO } from "./counts.ts";
import { EXERCICES, type Exercice } from "./exercices.ts";
import {
  ALIAS, allures, creneau, departDe, enCharge, estimation5k, maxDe, nomBloc, NOMS_SEANCES, prescriptions, seanceDuJour, seances, semaineDe,
  type Allures, type Bloc, type BlocReglage, type Occupation, type Perf, type Prescription, type SeanceDuJour, type SeanceFaite, type SportData, type TypeSeance,
} from "./sport.ts";

export interface SportView {
  aujourdhui: SeanceDuJour & { creneau: { debut: number; fin: number } | null; fiches: Record<string, Exercice> };
  semaine: { jour: string; type: TypeSeance; titre: string; faite: boolean; creneau: { debut: number; fin: number } | null }[];
  /** Programme modifié (sinon programme de départ). */
  semainePerso: boolean;
  /**
   * Charges actuelles et réglages de chaque exercice. `enCharge` : progresse en kg (sinon en reps ou secondes) ;
   * `depart` et `max` dans la même unité ; `pas` : saut des boutons + / −.
   */
  charges: { bloc: string; nom: string; prescription: Prescription; depart: number; max: number | null; unite: string; enCharge: boolean; pas: number; config: Bloc; reglage: BlocReglage | null }[];
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
  const semaine = semaineDe(d).map((_, i) => {
    const dj = todayISO(new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + i, 12).getTime());
    const x = seanceDuJour(d, dj, now);
    return { jour: dj, type: x.type, titre: x.course ? x.course.titre : NOMS_SEANCES[x.type], faite: !!x.faite, creneau: x.faite ? null : creneau(dj, x.dureeMin, cours, dj === jour ? now : undefined) };
  });
  const p = prescriptions(d);
  const parId = new Map<string, Bloc>();
  for (const b of Object.values(seances(d)).flat()) if (!parId.has(b.ex) && b.ex !== "echauffement-epaule") parId.set(b.ex, b);
  return {
    aujourdhui: { ...s, creneau: s.faite ? null : creneau(jour, s.dureeMin, cours, now), fiches },
    semaine,
    semainePerso: !!d.semaine,
    charges: [...parId.values()].map((b) => {
      const kg = enCharge(b);
      const dep = departDe(d, b);
      return {
        bloc: b.ex, nom: nomBloc(b.ex), prescription: p[b.ex], depart: kg ? dep.charge : dep.reps, max: maxDe(d, b) ?? null, unite: unite(b.ex), enCharge: kg,
        pas: kg ? b.increment ?? 2.5 : b.mode === "maintien" ? 5 : 1, config: b, reglage: d.reglages[b.ex] ?? null,
      };
    }),
    allures: allures(d, now),
    estimation: estimation5k(d, now),
    perfs: [...d.perfs].sort((x, y) => (y.jour ?? "") .localeCompare(x.jour ?? "")),
    historique: [...d.journal].reverse().slice(0, 30),
  };
}
