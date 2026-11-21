// Les décompositions montrées après une erreur : le même calcul, coupé en petits morceaux faciles.
import { fmt, morceaux } from "./question.ts";

/** 47 + 38 = 47 + 30 + 8 = 77 + 8 = 85 (et 8 + 7 = 8 + 2 + 5 = 10 + 5 = 15). */
export function etapesAddition(a: number, b: number): string[] {
  if (b < 10 && a < 10 && a + b > 10) {
    const vers10 = 10 - a;
    return [`${a} + ${b} = ${a} + ${vers10} + ${b - vers10}`, `= 10 + ${b - vers10}`, `= ${a + b}`];
  }
  if (b < 10) {
    const u = a % 10;
    if (u + b > 10) {
      const vers = 10 - u;
      return [`${fmt(a)} + ${b} = ${fmt(a)} + ${vers} + ${b - vers}`, `= ${fmt(a + vers)} + ${b - vers}`, `= ${fmt(a + b)}`];
    }
    return [`${fmt(a)} + ${b} = ${fmt(a + b)}`];
  }
  const m = morceaux(b);
  const out = [`${fmt(a)} + ${fmt(b)} = ${fmt(a)} + ${m.map(fmt).join(" + ")}`];
  let acc = a;
  for (let i = 0; i < m.length; i++) {
    acc += m[i];
    const reste = m.slice(i + 1);
    out.push(`= ${fmt(acc)}${reste.length ? " + " + reste.map(fmt).join(" + ") : ""}`);
  }
  return out;
}

/** 83 − 47 = 83 − 40 − 7 = 43 − 7 = 36 (et 15 − 7 = 15 − 5 − 2 = 10 − 2 = 8). */
export function etapesSoustraction(a: number, b: number): string[] {
  if (b < 10) {
    const u = a % 10;
    if (b > u && a > 10) {
      return [`${fmt(a)} − ${b} = ${fmt(a)} − ${u} − ${b - u}`, `= ${fmt(a - u)} − ${b - u}`, `= ${fmt(a - b)}`];
    }
    return [`${fmt(a)} − ${b} = ${fmt(a - b)}`];
  }
  const m = morceaux(b);
  const out = [`${fmt(a)} − ${fmt(b)} = ${fmt(a)} − ${m.map(fmt).join(" − ")}`];
  let acc = a;
  for (let i = 0; i < m.length; i++) {
    acc -= m[i];
    const reste = m.slice(i + 1);
    out.push(`= ${fmt(acc)}${reste.length ? " − " + reste.map(fmt).join(" − ") : ""}`);
  }
  return out;
}

/** a × b en coupant a selon ses positions : 47 × 6 = 40 × 6 + 7 × 6 = 240 + 42 = 282. */
export function etapesMultCoupeA(a: number, b: number): string[] {
  const m = morceaux(a);
  if (m.length === 1) return [`${fmt(a)} × ${fmt(b)} = ${fmt(a * b)}`];
  return [
    `${fmt(a)} × ${fmt(b)} = ${m.map((x) => `${fmt(x)} × ${fmt(b)}`).join(" + ")}`,
    `= ${m.map((x) => fmt(x * b)).join(" + ")}`,
    `= ${fmt(a * b)}`,
  ];
}

/** a × b en coupant b : 34 × 23 = 34 × 20 + 34 × 3 = 680 + 102 = 782. */
export function etapesMultCoupeB(a: number, b: number): string[] {
  const m = morceaux(b);
  if (m.length === 1) return [`${fmt(a)} × ${fmt(b)} = ${fmt(a * b)}`];
  return [
    `${fmt(a)} × ${fmt(b)} = ${m.map((x) => `${fmt(a)} × ${fmt(x)}`).join(" + ")}`,
    `= ${m.map((x) => fmt(a * x)).join(" + ")}`,
    `= ${fmt(a * b)}`,
  ];
}

/** Une multiplication des tables, avec un chemin pour la retrouver si on l'a oubliée. */
export function etapesTable(a: number, b: number): string[] {
  const r = a * b;
  const [p, g] = a <= b ? [a, b] : [b, a];
  if (p === 10 || g === 10) return [`${a} × ${b} : multiplier par 10, c'est ajouter un zéro`, `= ${r}`];
  if (p === 2) return [`${a} × ${b} = le double de ${g}`, `= ${g} + ${g}`, `= ${r}`];
  if (p === 9 || g === 9) {
    const o = p === 9 ? g : p;
    return [`${a} × ${b} = 10 × ${o} − ${o}`, `= ${10 * o} − ${o}`, `= ${r}`];
  }
  if (p === 4) return [`${a} × ${b} = le double du double de ${g}`, `= ${2 * g} × 2`, `= ${r}`];
  if (p === 5) return [`${a} × ${b} = la moitié de 10 × ${g}`, `= ${10 * g} ÷ 2`, `= ${r}`];
  if (g >= 6) return [`${a} × ${b} = ${p} × 5 + ${p} × ${g - 5}`, `= ${5 * p} + ${p * (g - 5)}`, `= ${r}`];
  return [`${a} × ${b} = ${g} + ${g}${p > 2 ? ` + ${g}`.repeat(p - 2) : ""}`, `= ${r}`];
}

/** Un pourcentage par les morceaux faciles (10 %, 5 %, moitié, quart…). */
export function etapesPourcent(p: number, y: number): string[] {
  const r = (p * y) / 100;
  const t = y / 10;
  const debut = `${p} % de ${fmt(y)}`;
  switch (p) {
    case 10: return [`${debut} = ${fmt(y)} ÷ 10`, `= ${fmt(r)}`];
    case 50: return [`${debut} = la moitié de ${fmt(y)}`, `= ${fmt(r)}`];
    case 25: return [`${debut} = le quart : la moitié de la moitié`, `= ${fmt(y / 2)} ÷ 2`, `= ${fmt(r)}`];
    case 20: return [`${debut} = 2 × 10 %`, `10 % de ${fmt(y)} = ${fmt(t)}`, `= 2 × ${fmt(t)} = ${fmt(r)}`];
    case 5: return [`${debut} = la moitié de 10 %`, `10 % de ${fmt(y)} = ${fmt(t)}`, `= ${fmt(t)} ÷ 2 = ${fmt(r)}`];
    case 75: return [`${debut} = 3 quarts`, `un quart = ${fmt(y)} ÷ 4 = ${fmt(y / 4)}`, `= 3 × ${fmt(y / 4)} = ${fmt(r)}`];
  }
  if (p % 10 === 0) return [`${debut} = ${p / 10} × 10 %`, `10 % de ${fmt(y)} = ${fmt(t)}`, `= ${p / 10} × ${fmt(t)} = ${fmt(r)}`];
  if (p % 10 === 5) {
    const d = Math.floor(p / 10);
    return [
      `${debut} = ${d === 1 ? "10 %" : `${d} × 10 %`} + 5 %`,
      `10 % de ${fmt(y)} = ${fmt(t)} ; 5 % = la moitié = ${fmt(t / 2)}`,
      `= ${d === 1 ? fmt(t) : fmt(d * t)} + ${fmt(t / 2)} = ${fmt(r)}`,
    ];
  }
  return [`${debut} = ${p} × ${fmt(y)} ÷ 100`, `= ${fmt(p * y)} ÷ 100`, `= ${fmt(r)}`];
}

/** « x % de y = y % de x » : 8 % de 50 = 50 % de 8 = 4. */
export function etapesPourcentEchange(p: number, y: number): string[] {
  return [`${p} % de ${fmt(y)} = ${fmt(y)} % de ${p}`, ...etapesPourcent(y, p).map((e, i) => (i === 0 ? `et ${e}` : e))];
}
