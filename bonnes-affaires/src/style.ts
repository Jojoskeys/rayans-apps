// L'allure des cartes Discord, boutique par boutique : couleur de la marque et pastille reconnaissable.

export interface Style {
  nom: string;
  emoji: string;
  couleur: number;
}

/** Clé = début du nom de boutique en minuscules, sans accents (tel que Dealabs ou eBay le donnent). */
const STYLES: [string, Style][] = [
  ["amazon", { nom: "Amazon", emoji: "🟠", couleur: 0xff9900 }],
  ["cdiscount", { nom: "Cdiscount", emoji: "🔵", couleur: 0x0f4fa8 }],
  ["fnac", { nom: "Fnac", emoji: "🟡", couleur: 0xe1a925 }],
  ["darty", { nom: "Darty", emoji: "🔴", couleur: 0xe30613 }],
  ["boulanger", { nom: "Boulanger", emoji: "🟥", couleur: 0xd6001c }],
  ["aliexpress", { nom: "AliExpress", emoji: "🧧", couleur: 0xff4747 }],
  ["ebay", { nom: "eBay", emoji: "🛍️", couleur: 0xe53238 }],
  ["vinted", { nom: "Vinted", emoji: "👕", couleur: 0x09b1ba }],
  ["leboncoin", { nom: "Leboncoin", emoji: "🧡", couleur: 0xff6e14 }],
  ["back market", { nom: "Back Market", emoji: "♻️", couleur: 0x1c1c1c }],
  ["rakuten", { nom: "Rakuten", emoji: "🟥", couleur: 0xbf0000 }],
  ["e.leclerc", { nom: "E.Leclerc", emoji: "🔷", couleur: 0x0066b3 }],
  ["leclerc", { nom: "E.Leclerc", emoji: "🔷", couleur: 0x0066b3 }],
  ["carrefour", { nom: "Carrefour", emoji: "🟦", couleur: 0x004e9f }],
  ["auchan", { nom: "Auchan", emoji: "🔺", couleur: 0xe2001a }],
  ["lidl", { nom: "Lidl", emoji: "🟨", couleur: 0x0050aa }],
  ["intermarche", { nom: "Intermarché", emoji: "🟥", couleur: 0xe2001a }],
  ["decathlon", { nom: "Decathlon", emoji: "🏃", couleur: 0x0082c3 }],
  ["ikea", { nom: "IKEA", emoji: "🛋️", couleur: 0x0058a3 }],
  ["manomano", { nom: "ManoMano", emoji: "🔧", couleur: 0x00b2a9 }],
  ["leroy merlin", { nom: "Leroy Merlin", emoji: "🔨", couleur: 0x78be20 }],
  ["zalando", { nom: "Zalando", emoji: "👟", couleur: 0xff6900 }],
  ["prive by zalando", { nom: "Privé by Zalando", emoji: "👟", couleur: 0xff6900 }],
  ["nike", { nom: "Nike", emoji: "✔️", couleur: 0x111111 }],
  ["adidas", { nom: "Adidas", emoji: "👟", couleur: 0x000000 }],
  ["sephora", { nom: "Sephora", emoji: "💄", couleur: 0x000000 }],
  ["apple", { nom: "Apple", emoji: "🍏", couleur: 0xa2aaad }],
  ["samsung", { nom: "Samsung", emoji: "📱", couleur: 0x1428a0 }],
  ["ldlc", { nom: "LDLC", emoji: "🖥️", couleur: 0x0b72b5 }],
  ["materiel.net", { nom: "Materiel.net", emoji: "🖥️", couleur: 0xe3001b }],
  ["micromania", { nom: "Micromania", emoji: "🎮", couleur: 0xe4032e }],
  ["steam", { nom: "Steam", emoji: "🎮", couleur: 0x1b2838 }],
  ["epic games", { nom: "Epic Games", emoji: "🎮", couleur: 0x2a2a2a }],
  ["playstation", { nom: "PlayStation Store", emoji: "🎮", couleur: 0x003791 }],
  ["xbox", { nom: "Xbox Store", emoji: "🎮", couleur: 0x107c10 }],
  ["nintendo", { nom: "Nintendo eShop", emoji: "🎮", couleur: 0xe60012 }],
  ["google play", { nom: "Google Play", emoji: "▶️", couleur: 0x01875f }],
  ["temu", { nom: "Temu", emoji: "🟧", couleur: 0xfb7701 }],
  ["shein", { nom: "Shein", emoji: "⬛", couleur: 0x222222 }],
];

const STYLE_AUTRE = { emoji: "🏷️", couleur: 0x5865f2 };

const sansAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function styleDe(boutique: string | undefined): Style {
  const b = sansAccents(boutique ?? "");
  // La clé la plus longue d'abord : « privé by zalando » avant « zalando ».
  const trouve = [...STYLES].sort((x, y) => y[0].length - x[0].length).find(([cle]) => b.startsWith(cle));
  return trouve ? trouve[1] : { nom: boutique?.trim() || "Bon plan", ...STYLE_AUTRE };
}

/** Température Dealabs en flammes : plus c'est chaud, plus la communauté valide l'affaire. */
export function flammes(degres: number): string {
  if (degres >= 1000) return `🔥🔥🔥 ${degres}°`;
  if (degres >= 300) return `🔥🔥 ${degres}°`;
  if (degres >= 100) return `🔥 ${degres}°`;
  if (degres < 0) return `🧊 ${degres}°`;
  return `🌡️ ${degres}°`;
}

/** Photo Dealabs en grand (le flux donne une vignette de 150 px). */
export function grandePhoto(url: string | undefined): string | undefined {
  return url?.replace("/re/150x150/", "/re/768x768/");
}
