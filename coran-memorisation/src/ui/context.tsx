import { createContext, useContext } from 'react';
import type { HifzData } from '../core/store.ts';

export interface QuranText {
  ar: string[][];
  fr: string[][];
}

export type View =
  | { name: 'today' }
  | { name: 'surahs' }
  | { name: 'surah'; sura: number; focus?: number }
  | { name: 'review'; mode: 'due' }
  | { name: 'review'; mode: 'practice'; sura: number; from: number; to: number }
  | { name: 'progress' }
  | { name: 'settings' };

export interface AppCtx {
  text: QuranText;
  data: HifzData;
  today: string;
  update: (fn: (d: HifzData) => HifzData) => void;
  go: (v: View) => void;
}

export const Ctx = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = (): AppCtx => useContext(Ctx);

const DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const arabicNumber = (n: number): string => String(n).replace(/\d/g, (d) => DIGITS[Number(d)]);
/** Fin de verset ornée (U+06DD suivi du numéro, dessiné par la police Amiri Quran). */
export const ayaMark = (n: number): string => `۝${arabicNumber(n)}`;

export const pct = (x: number): string => `${Math.round(x * 1000) / 10} %`.replace('.', ',');
