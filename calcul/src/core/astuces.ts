// Les 10 astuces : explication pas à pas, exemple animé, pourquoi ça marche, et générateur d'exercices.
// Ce sont des raccourcis exacts (de l'arithmétique), pas des méthodes « prouvées » : aucune étude ne mesure
// l'effet propre de chaque astuce. On les présente avec leur explication pour qu'elles aient du sens.
import { etapesMultCoupeA, etapesMultCoupeB, etapesPourcent, etapesPourcentEchange } from "./calculs.ts";
import { fmt, question, type AstuceId, type Question } from "./question.ts";
import { makeRng, pick, randInt, type Rng } from "./rng.ts";

export interface AstuceInfo {
  id: AstuceId;
  titre: string;
  icone: string;
  /** La règle en une ligne. */
  resume: string;
  /** L'explication, pas à pas. */
  etapes: string[];
  /** L'exemple animé : chaque ligne apparaît l'une après l'autre. */
  exemple: { calcul: string; images: string[] };
  /** Pourquoi ça marche, en une phrase. */
  pourquoi: string;
  gen: (rng: Rng, niveau: number) => Question;
}

const Q = (astuce: AstuceId, niveau: number, a: number, b: number, op: Question["op"], texte: string, reponse: number, etapes: string[]) =>
  question("astuces", niveau, a, b, op, texte, reponse, etapes, astuce);

function x11(rng: Rng, niveau: number): Question {
  if (niveau >= 3) {
    const n = randInt(rng, 101, 899);
    return Q("x11", niveau, n, 11, "×", `${n} × 11`, n * 11, [`${n} × 11 = ${n} × 10 + ${n}`, `= ${fmt(n * 10)} + ${n}`, `= ${fmt(n * 11)}`]);
  }
  let d: number, u: number;
  do { d = randInt(rng, 1, 9); u = randInt(rng, 1, 9); } while (niveau === 1 ? d + u >= 10 : d + u < 10);
  const n = 10 * d + u;
  const s = d + u;
  const etapes = s < 10
    ? [`${n} × 11 : écarte ${d} et ${u} → ${d} _ ${u}`, `au milieu : ${d} + ${u} = ${s}`, `= ${n * 11}`]
    : [`${n} × 11 : écarte ${d} et ${u} → ${d} _ ${u}`, `au milieu : ${d} + ${u} = ${s} → on écrit ${s - 10} et on ajoute 1 au ${d}`, `= ${n * 11}`];
  return Q("x11", niveau, n, 11, "×", `${n} × 11`, n * 11, etapes);
}

function carre5(rng: Rng, niveau: number): Question {
  const a = niveau === 1 ? randInt(rng, 1, 4) : niveau === 2 ? randInt(rng, 5, 9) : randInt(rng, 10, 19);
  const n = 10 * a + 5;
  return Q("carre5", niveau, n, n, "×", `${n} × ${n}`, n * n, [
    `${n} × ${n} : prends ${a} et multiplie-le par le nombre suivant`,
    `${a} × ${a + 1} = ${a * (a + 1)}`,
    `colle 25 à la fin → ${fmt(n * n)}`,
  ]);
}

function x9(rng: Rng, niveau: number): Question {
  if (niveau >= 3) {
    const n = randInt(rng, 12, 99);
    return Q("x9", niveau, 99, n, "×", `99 × ${n}`, 99 * n, [`99 × ${n} = 100 × ${n} − ${n}`, `= ${fmt(100 * n)} − ${n}`, `= ${fmt(99 * n)}`]);
  }
  const n = niveau === 1 ? randInt(rng, 12, 49) : randInt(rng, 51, 99);
  return Q("x9", niveau, 9, n, "×", `9 × ${n}`, 9 * n, [`9 × ${n} = 10 × ${n} − ${n}`, `= ${10 * n} − ${n}`, `= ${9 * n}`]);
}

function x5(rng: Rng, niveau: number): Question {
  if (niveau === 1) {
    const n = 2 * randInt(rng, 6, 49);
    return Q("x5", niveau, n, 5, "×", `${n} × 5`, n * 5, [`${n} × 5 = ${n} × 10 ÷ 2`, `= ${n * 10} ÷ 2`, `= ${n * 5}`]);
  }
  if (niveau === 2) {
    const n = randInt(rng, 12, 98);
    if (rng() < 0.5) return Q("x5", niveau, n, 50, "×", `${n} × 50`, n * 50, [`${n} × 50 = ${n} × 100 ÷ 2`, `= ${fmt(n * 100)} ÷ 2`, `= ${fmt(n * 50)}`]);
    return Q("x5", niveau, n, 5, "×", `${n} × 5`, n * 5, [`${n} × 5 = ${n} × 10 ÷ 2`, `= ${n * 10} ÷ 2`, `= ${n * 5}`]);
  }
  const n = rng() < 0.6 ? 4 * randInt(rng, 3, 24) : randInt(rng, 11, 99);
  return Q("x5", niveau, n, 25, "×", `${n} × 25`, n * 25, [`${n} × 25 = ${n} × 100 ÷ 4`, `= ${fmt(n * 100)} ÷ 2 ÷ 2 = ${fmt(n * 50)} ÷ 2`, `= ${fmt(n * 25)}`]);
}

function complements(rng: Rng, niveau: number): Question {
  const base = niveau === 1 ? 100 : niveau === 2 ? 1000 : 10000;
  let n: number;
  do n = randInt(rng, base / 10 + 1, base - base / 10 - 1); while (n % 10 === 0);
  const ch = String(n).padStart(String(base).length - 1, "0").split("").map(Number);
  const corr = ch.map((c, i) => `${c} → ${i === ch.length - 1 ? 10 - c : 9 - c}`).join(", ");
  return Q("complements", niveau, base, n, "−", `${fmt(base)} − ${fmt(n)}`, base - n, [
    `${fmt(base)} − ${fmt(n)} : chaque chiffre va jusqu'à 9, le dernier jusqu'à 10`,
    corr,
    `= ${fmt(base - n)}`,
  ]);
}

function decomposition(rng: Rng, niveau: number): Question {
  if (niveau === 3) {
    const a = randInt(rng, 12, 49);
    const b = randInt(rng, 11, 19);
    return Q("decomposition", niveau, a, b, "×", `${a} × ${b}`, a * b, etapesMultCoupeB(a, b));
  }
  let a: number;
  do a = niveau === 1 ? randInt(rng, 12, 98) : randInt(rng, 102, 698); while (a % 10 === 0);
  const b = randInt(rng, 3, 9);
  return Q("decomposition", niveau, a, b, "×", `${a} × ${b}`, a * b, etapesMultCoupeA(a, b));
}

function pourcent(rng: Rng, niveau: number): Question {
  if (niveau >= 3) {
    const y = pick(rng, [25, 50]);
    const p = y === 50 ? 2 * randInt(rng, 2, 19) : 4 * randInt(rng, 2, 9);
    return Q("pourcent", niveau, p, y, "%", `${p} % de ${y}`, (p * y) / 100, etapesPourcentEchange(p, y));
  }
  const p = niveau === 1 ? pick(rng, [10, 5]) : pick(rng, [15, 20]);
  const y = 20 * randInt(rng, 2, 30);
  return Q("pourcent", niveau, p, y, "%", `${p} % de ${y}`, (p * y) / 100, etapesPourcent(p, y));
}

function arrondir(rng: Rng, niveau: number): Question {
  if (niveau === 1) {
    if (rng() < 0.4) {
      const c = randInt(rng, 1, 5) * 100;
      const e = randInt(rng, 1, 3);
      const a = c - e;
      const b = randInt(rng, 112, 489);
      return Q("arrondir", niveau, a, b, "+", `${a} + ${b}`, a + b, [`${a} + ${b} ≈ ${c} + ${b} = ${c + b}`, `mais ${c} c'est ${e} de trop : ${c + b} − ${e}`, `= ${a + b}`]);
    }
    const r = randInt(rng, 2, 9) * 10;
    const e = randInt(rng, 1, 2);
    const a = r - e;
    const b = randInt(rng, 3, 9);
    return Q("arrondir", niveau, a, b, "×", `${a} × ${b}`, a * b, [`${a} × ${b} ≈ ${r} × ${b} = ${r * b}`, `on a compté ${e} × ${b} = ${e * b} de trop`, `${r * b} − ${e * b} = ${a * b}`]);
  }
  if (niveau === 2) {
    const r = randInt(rng, 2, 9) * 100;
    const e = randInt(rng, 1, 3);
    const a = r - e;
    const b = randInt(rng, 3, 9);
    return Q("arrondir", niveau, a, b, "×", `${a} × ${b}`, a * b, [`${a} × ${b} ≈ ${r} × ${b} = ${fmt(r * b)}`, `on a compté ${e} × ${b} = ${e * b} de trop`, `${fmt(r * b)} − ${e * b} = ${fmt(a * b)}`]);
  }
  const r = pick(rng, [20, 30, 40, 50]);
  const b = r - 1;
  const a = randInt(rng, 12, 49);
  return Q("arrondir", niveau, a, b, "×", `${a} × ${b}`, a * b, [`${a} × ${b} ≈ ${a} × ${r} = ${fmt(a * r)}`, `on a compté ${a} de trop`, `${fmt(a * r)} − ${a} = ${fmt(a * b)}`]);
}

function proche100(rng: Rng, niveau: number): Question {
  if (niveau === 2) {
    const a = randInt(rng, 101, 109);
    const b = randInt(rng, 101, 109);
    const ea = a - 100, eb = b - 100;
    return Q("proche100", niveau, a, b, "×", `${a} × ${b}`, a * b, [
      `${a} × ${b} : ${ea} et ${eb} de plus que 100`,
      `${a} + ${eb} = ${a + eb} → ${a + eb} centaines`,
      `${ea} × ${eb} = ${ea * eb} → ${fmt((a + eb) * 100)} + ${ea * eb} = ${fmt(a * b)}`,
    ]);
  }
  const lo = niveau === 1 ? 91 : 85;
  const a = randInt(rng, lo, 99);
  const b = randInt(rng, lo, 99);
  const da = 100 - a, db = 100 - b;
  return Q("proche100", niveau, a, b, "×", `${a} × ${b}`, a * b, [
    `${a} × ${b} : il manque ${da} et ${db} pour 100`,
    `${a} − ${db} = ${a - db} → ${a - db} centaines`,
    `${da} × ${db} = ${da * db} → ${fmt((a - db) * 100)} + ${da * db} = ${fmt(a * b)}`,
  ]);
}

function div5(rng: Rng, niveau: number): Question {
  const n = 5 * (niveau === 1 ? randInt(rng, 3, 19) : niveau === 2 ? randInt(rng, 21, 199) : randInt(rng, 201, 999));
  return Q("div5", niveau, n, 5, "÷", `${fmt(n)} ÷ 5`, n / 5, [`${fmt(n)} ÷ 5 = ${fmt(n)} × 2 ÷ 10`, `= ${fmt(2 * n)} ÷ 10`, `= ${fmt(n / 5)}`]);
}

export const ASTUCES: AstuceInfo[] = [
  {
    id: "x11", titre: "Multiplier par 11", icone: "1️⃣",
    resume: "Écarte les deux chiffres et mets leur somme au milieu.",
    etapes: ["Prends le nombre à 2 chiffres, par exemple 43.", "Écarte ses deux chiffres : 4 _ 3.", "Au milieu, écris leur somme : 4 + 3 = 7.", "Résultat : 473. Si la somme fait 10 ou plus, garde l'unité au milieu et ajoute 1 au premier chiffre (78 × 11 = 858)."],
    exemple: { calcul: "43 × 11", images: ["43 × 11", "4  _  3", "4 + 3 = 7", "4  7  3", "= 473"] },
    pourquoi: "× 11, c'est × 10 + × 1 : 430 + 43 ; les dizaines de l'un tombent sur les unités de l'autre, d'où la somme au milieu.",
    gen: x11,
  },
  {
    id: "carre5", titre: "Carré d'un nombre en 5", icone: "5️⃣",
    resume: "Le chiffre des dizaines × le suivant, puis colle 25.",
    etapes: ["Prends un nombre qui finit par 5, par exemple 35.", "Garde le début : 3.", "Multiplie-le par le nombre suivant : 3 × 4 = 12.", "Colle 25 à la fin : 1225."],
    exemple: { calcul: "35 × 35", images: ["35 × 35", "3 → 3 × 4", "= 12", "12 | 25", "= 1225"] },
    pourquoi: "(10a + 5)² = 100 × a × (a + 1) + 25 : le début donne les centaines, et 5 × 5 donne toujours 25.",
    gen: carre5,
  },
  {
    id: "x9", titre: "Multiplier par 9 (et 99)", icone: "9️⃣",
    resume: "× 10, puis enlève le nombre une fois.",
    etapes: ["Pour 9 × 47, calcule d'abord 10 × 47 = 470.", "Enlève 47 une fois : 470 − 47.", "Résultat : 423.", "Pareil avec 99 : × 100, puis enlève le nombre."],
    exemple: { calcul: "9 × 47", images: ["9 × 47", "10 × 47 = 470", "470 − 47", "= 423"] },
    pourquoi: "9 = 10 − 1, donc 9 × 47 = 10 × 47 − 1 × 47.",
    gen: x9,
  },
  {
    id: "x5", titre: "× 5, × 25 et × 50", icone: "✋",
    resume: "× 5 = × 10 puis moitié ; × 50 = × 100 puis moitié ; × 25 = × 100 puis quart.",
    etapes: ["× 5 : multiplie par 10, puis prends la moitié (48 × 5 = 480 ÷ 2 = 240).", "× 50 : multiplie par 100, puis prends la moitié.", "× 25 : multiplie par 100, puis divise par 4 (moitié de la moitié)."],
    exemple: { calcul: "48 × 5", images: ["48 × 5", "48 × 10 = 480", "480 ÷ 2", "= 240"] },
    pourquoi: "5 = 10 ÷ 2, 50 = 100 ÷ 2 et 25 = 100 ÷ 4 : on remplace une multiplication difficile par deux faciles.",
    gen: x5,
  },
  {
    id: "complements", titre: "Compléments à 100 et 1000", icone: "🔟",
    resume: "Chaque chiffre va jusqu'à 9, le dernier jusqu'à 10.",
    etapes: ["Pour 1000 − 368, regarde chaque chiffre de 368.", "3 → 6 et 6 → 3 (ce qui manque pour faire 9).", "Le dernier, 8 → 2 (ce qui manque pour faire 10).", "Résultat : 632. Marche quand le dernier chiffre n'est pas 0."],
    exemple: { calcul: "1000 − 368", images: ["1000 − 368", "3 → 6", "6 → 3", "8 → 2", "= 632"] },
    pourquoi: "999 − 368 n'a jamais de retenue (chaque chiffre fait 9), et 1000 = 999 + 1 : d'où le « 10 » sur le dernier chiffre.",
    gen: complements,
  },
  {
    id: "decomposition", titre: "Décomposer", icone: "🧩",
    resume: "Coupe un nombre en morceaux ronds, multiplie chaque morceau, additionne.",
    etapes: ["Pour 48 × 5, coupe 48 en 40 + 8.", "40 × 5 = 200 et 8 × 5 = 40.", "Additionne : 200 + 40 = 240.", "Marche aussi avec deux nombres à 2 chiffres : 23 × 14 = 23 × 10 + 23 × 4."],
    exemple: { calcul: "48 × 5", images: ["48 × 5", "(40 + 8) × 5", "40 × 5 = 200", "8 × 5 = 40", "200 + 40 = 240"] },
    pourquoi: "Multiplier une somme, c'est multiplier chacun de ses morceaux (la distributivité) : on ne perd rien en coupant.",
    gen: decomposition,
  },
  {
    id: "pourcent", titre: "Pourcentages faciles", icone: "％",
    resume: "10 % = ÷ 10 ; 5 % = moitié de 10 % ; 15 % = 10 % + 5 % ; 20 % = 2 × 10 %. Et x % de y = y % de x.",
    etapes: ["10 % : divise par 10 (10 % de 60 = 6).", "5 % : la moitié de 10 % (3).", "15 % = 10 % + 5 % (6 + 3 = 9) ; 20 % = 2 × 10 % (12).", "Astuce bonus : 8 % de 50 = 50 % de 8 = 4. Choisis le sens le plus facile."],
    exemple: { calcul: "15 % de 60", images: ["15 % de 60", "10 % = 6", "5 % = 3", "6 + 3", "= 9"] },
    pourquoi: "« x % de y » veut dire x × y ÷ 100 : on peut couper x en morceaux faciles, et l'ordre d'une multiplication ne change rien.",
    gen: pourcent,
  },
  {
    id: "arrondir", titre: "Arrondir puis corriger", icone: "🎯",
    resume: "Calcule avec un nombre rond, puis corrige ce que tu as ajouté en trop.",
    etapes: ["Pour 49 × 6, prends le nombre rond 50 : 50 × 6 = 300.", "Tu as compté 1 × 6 = 6 de trop.", "Corrige : 300 − 6 = 294.", "Pareil pour une addition : 198 + 347 = 200 + 347 − 2."],
    exemple: { calcul: "49 × 6", images: ["49 × 6", "≈ 50 × 6 = 300", "6 de trop", "300 − 6", "= 294"] },
    pourquoi: "Un nombre rond se calcule de tête sans effort ; il suffit ensuite de rendre exactement ce qu'on a ajouté.",
    gen: arrondir,
  },
  {
    id: "proche100", titre: "Multiplier près de 100", icone: "💯",
    resume: "Regarde ce qui manque pour 100 : croise pour les centaines, multiplie les écarts pour la fin.",
    etapes: ["Pour 97 × 94 : il manque 3 et 6 pour arriver à 100.", "Enlève l'écart en croix : 97 − 6 = 91 (ou 94 − 3). Ce sont les centaines : 9100.", "Multiplie les écarts : 3 × 6 = 18.", "Additionne : 9100 + 18 = 9118."],
    exemple: { calcul: "97 × 94", images: ["97 × 94", "manque 3 et 6", "97 − 6 = 91", "3 × 6 = 18", "= 9118"] },
    pourquoi: "(100 − a) × (100 − b) = 100 × (100 − a − b) + a × b : c'est juste le développement, écrit de façon pratique.",
    gen: proche100,
  },
  {
    id: "div5", titre: "Diviser par 5", icone: "➗",
    resume: "Double, puis divise par 10.",
    etapes: ["Pour 135 ÷ 5, double d'abord : 135 × 2 = 270.", "Divise par 10 : 27.", "C'est souvent plus facile que de chercher combien de fois 5 rentre dans 135."],
    exemple: { calcul: "135 ÷ 5", images: ["135 ÷ 5", "135 × 2 = 270", "270 ÷ 10", "= 27"] },
    pourquoi: "5 = 10 ÷ 2, donc diviser par 5 revient à multiplier par 2 puis diviser par 10.",
    gen: div5,
  },
];

export const astuceInfo = (id: AstuceId): AstuceInfo => ASTUCES.find((a) => a.id === id)!;

/** Les niveaux des 10 exercices dédiés : on commence facile, on finit plus dur. */
export const NIVEAUX_EXERCICES = [1, 1, 1, 1, 2, 2, 2, 3, 3, 3];

/** Les 10 exercices d'une astuce (tous différents), reproductibles avec la graine. */
export function exercicesAstuce(id: AstuceId, graine: number): Question[] {
  const rng = makeRng(graine);
  const info = astuceInfo(id);
  const vus = new Set<string>();
  return NIVEAUX_EXERCICES.map((n) => {
    let q = info.gen(rng, n);
    for (let essai = 0; essai < 30 && vus.has(q.texte); essai++) q = info.gen(rng, n);
    vus.add(q.texte);
    return q;
  });
}
