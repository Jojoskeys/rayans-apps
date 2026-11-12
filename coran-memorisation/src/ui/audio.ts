// Lecteur audio verset par verset (Mahmoud Khalil Al-Husary, murattal), avec répétition de chaque verset.
import { useSyncExternalStore } from 'react';
import { audioFileName } from '../core/quran.ts';
import { audioUrl } from './api.ts';

export interface Track {
  sura: number;
  aya: number;
  /** Piste de la basmala jouée avant le verset 1 (fichier 001001). */
  basmala?: boolean;
}

export interface PlayerState {
  current: Track | null;
  playing: boolean;
  loading: boolean;
  error: string | null;
  /** Répétition en cours (1 à repeat). */
  pass: number;
}

let state: PlayerState = { current: null, playing: false, loading: false, error: null, pass: 1 };
const listeners = new Set<() => void>();
const el = new Audio();
el.preload = 'auto';
let queue: Track[] = [];
let index = 0;
let repeat = 1;

function set(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function load() {
  const t = queue[index];
  if (!t) {
    stop();
    return;
  }
  set({ current: t, loading: true, error: null, playing: true });
  el.src = audioUrl(t.basmala ? audioFileName(1, 1) : audioFileName(t.sura, t.aya));
  el.play().catch(() => {
    /* l'erreur est signalée par l'événement « error » */
  });
}

el.addEventListener('playing', () => set({ loading: false, playing: true }));
el.addEventListener('pause', () => {
  if (!el.ended) set({ playing: false });
});
el.addEventListener('error', () => {
  set({ loading: false, playing: false, error: 'Audio indisponible : vérifie la connexion Internet (les versets déjà écoutés restent disponibles hors ligne).' });
});
el.addEventListener('ended', () => {
  const t = queue[index];
  if (t && !t.basmala && state.pass < repeat) {
    set({ pass: state.pass + 1 });
    el.currentTime = 0;
    el.play().catch(() => {});
    return;
  }
  index++;
  set({ pass: 1 });
  load();
});

/** Joue une suite de versets ; chaque verset est répété « times » fois. */
export function playTracks(tracks: Track[], times = 1) {
  queue = tracks;
  index = 0;
  repeat = Math.max(1, times);
  set({ pass: 1 });
  load();
}

/** Versets d'une sourate de « from » à « to », avec la basmala avant le verset 1 (sauf sourates 1 et 9). */
export function surahTracks(sura: number, from: number, to: number): Track[] {
  const list: Track[] = [];
  if (from === 1 && sura !== 1 && sura !== 9) list.push({ sura, aya: 1, basmala: true });
  for (let a = from; a <= to; a++) list.push({ sura, aya: a });
  return list;
}

export function togglePause() {
  if (!state.current) return;
  if (el.paused) el.play().catch(() => {});
  else el.pause();
}

export function stop() {
  el.pause();
  queue = [];
  index = 0;
  set({ current: null, playing: false, loading: false, pass: 1 });
}

export function usePlayer(): PlayerState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const isCurrent = (p: PlayerState, sura: number, aya: number) =>
  !!p.current && !p.current.basmala && p.current.sura === sura && p.current.aya === aya;
