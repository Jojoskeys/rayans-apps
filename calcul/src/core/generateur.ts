// Le générateur d'opérations : un type, un niveau, un tirage (reproductible avec la graine).
import { astuceInfo } from "./astuces.ts";
import { etapesAddition, etapesMultCoupeA, etapesMultCoupeB, etapesPourcent, etapesPourcentEchange, etapesSoustraction, etapesTable } from "./calculs.ts";
import { typeInfo } from "./niveaux.ts";
import { fmt, question, type AstuceId, type Question, type TypeId } from "./question.ts";
import { pick, randInt, type Rng } from "./rng.ts";

const borne = (type: TypeId, n: number) => Math.min(typeInfo(type).max, Math.max(typeInfo(type).min, Math.round(n)));

function addition(rng: Rng, n: number): Question {
  const [a, b] =
    n === 1 ? [randInt(rng, 2, 9), randInt(rng, 2, 9)]
    : n === 2 ? [randInt(rng, 12, 89), randInt(rng, 3, 9)]
    : n === 3 ? [randInt(rng, 12, 89), randInt(rng, 12, 89)]
    : n === 4 ? [randInt(rng, 102, 899), randInt(rng, 12, 99)]
    : [randInt(rng, 102, 899), randInt(rng, 102, 899)];
  return question("addition", n, a, b, "+", `${fmt(a)} + ${fmt(b)}`, a + b, etapesAddition(a, b));
}

function soustraction(rng: Rng, n: number): Question {
  let a: number, b: number;
  if (n === 1) { a = randInt(rng, 11, 18); b = randInt(rng, a - 9, 9); }
  else if (n === 2) { a = randInt(rng, 21, 99); b = randInt(rng, 3, 9); }
  else if (n === 3) { a = randInt(rng, 31, 99); b = randInt(rng, 12, a - 5); }
  else if (n === 4) { a = randInt(rng, 120, 999); b = randInt(rng, 12, 99); }
  else { a = randInt(rng, 300, 999); b = randInt(rng, 102, a - 50); }
  return question("soustraction", n, a, b, "−", `${fmt(a)} − ${fmt(b)}`, a - b, etapesSoustraction(a, b));
}

function tables(rng: Rng, n: number): Question {
  let a: number, b: number;
  if (n === 1) { a = pick(rng, [2, 3, 4, 5, 10]); b = randInt(rng, 2, 10); }
  else if (n === 2) { a = randInt(rng, 2, 9); b = randInt(rng, 2, 9); }
  else { a = randInt(rng, 6, 9); b = randInt(rng, 6, 9); }
  if (rng() < 0.5) [a, b] = [b, a];
  if (n === 4) {
    const p = a * b;
    return question("tables", n, p, a, "÷", `${p} ÷ ${a}`, b, [`${p} ÷ ${a} : cherche dans la table de ${a}`, `${a} × ${b} = ${p}`, `= ${b}`]);
  }
  return question("tables", n, a, b, "×", `${a} × ${b}`, a * b, etapesTable(a, b));
}

function mult1(rng: Rng, n: number): Question {
  let a: number;
  do a = n === 1 ? randInt(rng, 11, 49) : n === 2 ? randInt(rng, 11, 99) : n === 3 ? randInt(rng, 101, 499) : randInt(rng, 101, 999); while (a % 10 === 0);
  const b = n === 1 ? randInt(rng, 2, 5) : n === 4 ? randInt(rng, 3, 9) : randInt(rng, 2, 9);
  return question("mult1", n, a, b, "×", `${fmt(a)} × ${b}`, a * b, etapesMultCoupeA(a, b));
}

function mult2(rng: Rng, n: number): Question {
  const [a, b] =
    n === 1 ? [randInt(rng, 12, 39), randInt(rng, 11, 19)]
    : n === 2 ? [randInt(rng, 12, 39), randInt(rng, 12, 39)]
    : n === 3 ? [randInt(rng, 21, 99), randInt(rng, 12, 59)]
    : [randInt(rng, 21, 99), randInt(rng, 21, 99)];
  return question("mult2", n, a, b, "×", `${a} × ${b}`, a * b, etapesMultCoupeB(a, b));
}

function pourcentages(rng: Rng, n: number): Question {
  let p: number, y: number;
  if (n === 4) {
    y = pick(rng, [25, 50]);
    p = y === 50 ? 2 * randInt(rng, 2, 24) : 4 * randInt(rng, 2, 12);
    return question("pourcentages", n, p, y, "%", `${p} % de ${y}`, (p * y) / 100, etapesPourcentEchange(p, y));
  }
  if (n === 1) {
    p = pick(rng, [10, 50]);
    y = p === 10 ? 10 * randInt(rng, 2, 90) : 2 * randInt(rng, 6, 99);
  } else if (n === 2) {
    p = pick(rng, [25, 20, 5]);
    y = p === 25 ? 4 * randInt(rng, 5, 60) : p === 20 ? 10 * randInt(rng, 2, 50) : 20 * randInt(rng, 2, 40);
  } else if (n === 3) {
    p = pick(rng, [15, 30, 75]);
    y = p === 15 ? 20 * randInt(rng, 2, 30) : p === 30 ? 10 * randInt(rng, 2, 60) : 4 * randInt(rng, 5, 50);
  } else {
    p = pick(rng, [35, 45, 55, 65, 85, 95, 40, 60, 70, 90]);
    y = 20 * randInt(rng, 2, 25);
  }
  return question("pourcentages", n, p, y, "%", `${p} % de ${fmt(y)}`, (p * y) / 100, etapesPourcent(p, y));
}

/**
 * Une question du type et du niveau demandés. Pour « astuces », `vues` donne les astuces déjà apprises
 * (sinon la décomposition, la plus générale).
 */
export function genererQuestion(type: TypeId, niveau: number, rng: Rng, vues: AstuceId[] = []): Question {
  const n = borne(type, niveau);
  switch (type) {
    case "addition": return addition(rng, n);
    case "soustraction": return soustraction(rng, n);
    case "tables": return tables(rng, n);
    case "mult1": return mult1(rng, n);
    case "mult2": return mult2(rng, n);
    case "pourcentages": return pourcentages(rng, n);
    case "astuces": return astuceInfo(vues.length ? pick(rng, vues) : "decomposition").gen(rng, n);
  }
}

/** Estimation acceptée si elle est à 10 % près de la réponse exacte. */
export function estimationOk(estimation: number, exact: number): boolean {
  if (exact === 0) return estimation === 0;
  return Math.abs(estimation - exact) <= Math.abs(exact) * 0.1 + 1e-9;
}

/** L'écart d'une estimation, en % de la réponse (arrondi). */
export const ecartPourcent = (estimation: number, exact: number): number =>
  exact === 0 ? (estimation === 0 ? 0 : 100) : Math.round((Math.abs(estimation - exact) / Math.abs(exact)) * 100);

/** Arrondi à 1 chiffre significatif (47 → 50, 368 → 400), ou 2 pour les nombres à 3 chiffres et plus. */
export function arrondiRapide(n: number): number {
  const abs = Math.abs(n);
  if (abs < 10) return n;
  const chiffres = String(Math.round(abs)).length;
  const pas = 10 ** (chiffres >= 3 ? chiffres - 2 : chiffres - 1);
  return Math.sign(n) * Math.round(abs / pas) * pas;
}

/** Une façon rapide d'estimer la question (« 47 × 6 ≈ 50 × 6 = 300 »). */
export function guideEstimation(q: Question): string {
  const ra = arrondiRapide(q.a);
  const rb = arrondiRapide(q.b);
  switch (q.op) {
    case "+": return `${fmt(q.a)} + ${fmt(q.b)} ≈ ${fmt(ra)} + ${fmt(rb)} = ${fmt(ra + rb)}`;
    case "−": return `${fmt(q.a)} − ${fmt(q.b)} ≈ ${fmt(ra)} − ${fmt(rb)} = ${fmt(ra - rb)}`;
    case "×": return `${fmt(q.a)} × ${fmt(q.b)} ≈ ${fmt(ra)} × ${fmt(rb)} = ${fmt(ra * rb)}`;
    case "÷": return `${fmt(q.a)} ÷ ${fmt(q.b)} ≈ ${fmt(ra)} ÷ ${fmt(q.b)} ≈ ${fmt(Math.round(ra / q.b))}`;
    case "%": return `${q.a} % de ${fmt(q.b)} ≈ ${Math.round(q.a / 10)} × 10 % = ${Math.round(q.a / 10)} × ${fmt(q.b / 10)} ≈ ${fmt(Math.round((Math.round(q.a / 10) * q.b) / 10))}`;
  }
}
