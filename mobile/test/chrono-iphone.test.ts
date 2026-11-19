import { test } from "node:test";
import assert from "node:assert/strict";
import { createData, reduce } from "../../chrono/src/core/engine.ts";
import { finPrevue, lienRaccourci, messageFin } from "../src/shared/chrono-iphone.ts";

const ctx = (now: number) => ({ now, newId: () => Math.random().toString(36).slice(2) });

test("chrono iPhone : lien du raccourci avec le temps restant en secondes", () => {
  assert.equal(lienRaccourci("Chrono Rayan", 1499.6), "shortcuts://run-shortcut?name=Chrono%20Rayan&input=text&text=1500");
  assert.equal(lienRaccourci("Pomodoro & co", 0.2), "shortcuts://run-shortcut?name=Pomodoro%20%26%20co&input=text&text=1");
});

test("chrono iPhone : rappel prévu seulement quand le Pomodoro tourne", () => {
  let d = createData(ctx(0));
  assert.equal(finPrevue(d), null);
  d = reduce(d, { type: "start" }, ctx(1000)).data;
  assert.equal(finPrevue(d), 1000 + d.settings.workMin * 60_000);
  assert.match(messageFin(d).titre, /Pomodoro terminé/);
  d = reduce(d, { type: "pause" }, ctx(2000)).data;
  assert.equal(finPrevue(d), null);
  d = reduce(d, { type: "setMode", mode: "chrono" }, ctx(3000)).data;
  d = reduce(d, { type: "start" }, ctx(4000)).data;
  assert.equal(finPrevue(d), null);
});
