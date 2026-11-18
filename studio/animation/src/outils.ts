import { Easing, interpolate, random, spring } from "remotion";
import type { Mot, Plan, Segment } from "./types";

export const W = 1080;
export const H = 1920;
export const FPS = 30;

export const OR = "#F7C04A";
export const OR_PALE = "#FBE3A6";
export const ROUGE = "#FF4D4D";
export const VERT = "#3DDC84";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 -> 1 entre deux frames, avec un adoucissement. */
export const prog = (f: number, a: number, b: number, ease = Easing.inOut(Easing.cubic)) =>
  interpolate(f, [a, b], [0, 1], { ...clamp, easing: ease });

export const ressort = (f: number, debut: number, config = { damping: 12, stiffness: 140, mass: 0.7 }) =>
  spring({ frame: f - debut, fps: FPS, config });

export const rnd = (graine: string | number) => random(graine);

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Frame (relative au plan) où l'on dit un mot. `n` = n-ième occurrence. */
export function quand(plan: Plan, mot: string, n = 0, defaut = 0): number {
  const cible = norm(mot);
  let vu = 0;
  for (const m of plan.mots) {
    const x = norm(m.texte);
    if (x === cible || x.endsWith(cible) || x.startsWith(cible)) {
      if (vu === n) return m.debut - plan.debut;
      vu++;
    }
  }
  return defaut;
}

export function regrouperPlans(segments: Segment[]): Plan[] {
  const plans: Plan[] = [];
  for (const s of segments) {
    const der = plans[plans.length - 1];
    if (der && der.scene === s.scene) {
      der.fin = s.fin;
      der.segments.push(s);
      der.mots.push(...(s.mots ?? []));
    } else {
      plans.push({ scene: s.scene, debut: s.debut, fin: s.fin, segments: [s], mots: [...(s.mots ?? [])] });
    }
  }
  return plans;
}

export const tousLesMots = (segments: Segment[]): Mot[] => segments.flatMap((s) => s.mots ?? []);
