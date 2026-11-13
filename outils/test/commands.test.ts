import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, parseDuration, parseSize, pickOutput, suggest, wifiQrText } from "../src/core/commands.ts";
import { findSetting } from "../src/core/compress.ts";

test("commandes tapées", () => {
  assert.deepEqual(parse("pdf"), { tool: "pdf" });
  assert.deepEqual(parse("img 1mo"), { tool: "img", targetKo: 1024 });
  assert.deepEqual(parse("Image 500 Ko"), { tool: "img", targetKo: 500 });
  assert.deepEqual(parse("img"), { tool: "img", targetKo: null });
  assert.deepEqual(parse("tel https://exemple.fr"), { tool: "tel", text: "https://exemple.fr" });
  assert.deepEqual(parse("son"), { tool: "son", query: null });
  assert.deepEqual(parse("son casque"), { tool: "son", query: "casque" });
  assert.deepEqual(parse("casque"), { tool: "son", query: "casque" });
  assert.deepEqual(parse("éteins 45"), { tool: "eteins", mode: "eteindre", minutes: 45, cancel: false });
  assert.deepEqual(parse("eteins 1h30"), { tool: "eteins", mode: "eteindre", minutes: 90, cancel: false });
  assert.deepEqual(parse("veille 20"), { tool: "eteins", mode: "veille", minutes: 20, cancel: false });
  assert.deepEqual(parse("redemarre 10"), { tool: "eteins", mode: "redemarrer", minutes: 10, cancel: false });
  assert.deepEqual(parse("eteins annuler"), { tool: "eteins", mode: "eteindre", minutes: null, cancel: true });
  assert.equal(parse("bonjour"), null);
  assert.equal(parse(""), null);
});

test("tailles et durées", () => {
  assert.equal(parseSize("1,5mo"), 1536);
  assert.equal(parseSize("2 MB"), 2048);
  assert.equal(parseSize("800"), 800);
  assert.equal(parseSize("5"), null); // trop petit pour une image
  assert.equal(parseSize("abc"), null);
  assert.equal(parseDuration("45"), 45);
  assert.equal(parseDuration("45 min"), 45);
  assert.equal(parseDuration("2h"), 120);
  assert.equal(parseDuration("1 h 15"), 75);
  assert.equal(parseDuration("0"), null);
  assert.equal(parseDuration("3000"), null);
});

test("suggestions", () => {
  assert.equal(suggest("").length, 7);
  assert.equal(suggest("im")[0].id, "img");
  assert.equal(suggest("ete")[0].id, "eteins");
  assert.equal(suggest("veille")[0].id, "eteins");
  assert.equal(suggest("zzz").length, 0);
});

test("QR code Wi-Fi : caractères spéciaux échappés", () => {
  assert.equal(wifiQrText("Box;Maison", 'a:b"c', "WPA2PSK"), 'WIFI:T:WPA;S:Box\\;Maison;P:a\\:b\\"c;;');
  assert.equal(wifiQrText("Libre", null, "open"), "WIFI:T:nopass;S:Libre;;");
  assert.equal(wifiQrText("Box", "k", "WPA3SAE"), "WIFI:T:WPA;S:Box;P:k;;");
});

test("choix de la sortie audio", () => {
  const outs = [
    { id: "a", nom: "PL2740HS (NVIDIA High Definition Audio)", parDefaut: false },
    { id: "b", nom: "Haut-parleurs (Logitech PRO X Wireless Gaming Headset)", parDefaut: true },
    { id: "c", nom: "Haut-parleurs (Realtek(R) Audio)", parDefaut: false },
  ];
  assert.equal(pickOutput(outs, null)!.id, "c"); // suivante
  assert.equal(pickOutput(outs, "casque")!.id, "b");
  assert.equal(pickOutput(outs, "enceintes")!.id, "c"); // pas le casque nommé « Haut-parleurs »
  assert.equal(pickOutput(outs, "nvidia")!.id, "a");
  assert.equal(pickOutput(outs, "inexistant"), null);
  assert.equal(pickOutput([], null), null);
});

test("compression : plus grande image possible sous la cible", async () => {
  // Modèle : taille ∝ surface × qualité.
  const enc = (scale: number, q: number) => Math.round(4_000_000 * scale * scale * (q / 90));
  const c = await findSetting(1_000_000, enc);
  assert.ok(c.ok && c.bytes <= 1_000_000);
  assert.equal(c.scale, 0.6); // 1 et 0,85 ne passent pas même à la qualité 50, 0,7 non plus
  const easy = await findSetting(10_000_000, enc);
  assert.deepEqual([easy.scale, easy.quality], [1, 90]);
  const impossible = await findSetting(10, enc);
  assert.equal(impossible.ok, false);
  const capped = await findSetting(10_000_000, enc, 0.5);
  assert.equal(capped.scale, 0.5);
});
