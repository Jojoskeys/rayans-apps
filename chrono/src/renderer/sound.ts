// Carillon de fin de phase, synthétisé (aucun fichier son) : montant pour reprendre le travail,
// descendant pour aller en pause.
import type { Phase } from "../core/types.ts";

let ctx: AudioContext | null = null;

export function playChime(to: Phase, volume: number) {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  const gainMax = Math.max(0, Math.min(1, volume / 100)) * 0.35;
  const notes = to === "travail" ? [523.25, 659.25, 783.99] : [783.99, 659.25, 523.25];
  const t0 = ctx.currentTime + 0.02;
  notes.forEach((f, i) => {
    const start = t0 + i * 0.22;
    for (const [mult, g] of [[1, 1], [2, 0.25]] as const) {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = f * mult;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(gainMax * g, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + 0.95);
    }
  });
}
