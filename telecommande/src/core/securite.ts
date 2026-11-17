// Sécurité de la télécommande : code d'association, comparaison à temps constant et limite d'essais.
// La première barrière est Tailscale (seuls tes appareils atteignent le PC) ; ce code en est une seconde.
import { randomBytes, timingSafeEqual, createHash } from "node:crypto";

// Alphabet sans caractères ambigus (pas de 0/O, 1/I/L) : facile à recopier sur un téléphone.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Code de 20 caractères (≈ 99 bits), affiché par groupes de 5 : « ABCDE-FGHJK-MNPQR-STUVW ». */
export function genererCode(): string {
  const octets = randomBytes(20);
  let s = "";
  for (const o of octets) s += ALPHABET[o % ALPHABET.length];
  return s.match(/.{5}/g)!.join("-");
}

/** Retire espaces et tirets, met en majuscules : « abcde fghjk… » = « ABCDE-FGHJK-… ». */
export function normaliserCode(c: string): string {
  return c.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Compare deux codes sans fuite de temps (les empreintes ont toujours la même longueur). */
export function codeValide(donne: string | undefined | null, attendu: string): boolean {
  if (!donne || !attendu) return false;
  const a = createHash("sha256").update(normaliserCode(donne)).digest();
  const b = createHash("sha256").update(normaliserCode(attendu)).digest();
  return timingSafeEqual(a, b) && normaliserCode(attendu).length >= 20;
}

/** Après `max` échecs en `fenetreMs`, tout est refusé pendant `blocageMs` (même avec le bon code). */
export class LimiteEssais {
  private echecs: number[] = [];
  private bloqueJusqua = 0;
  private max: number;
  private fenetreMs: number;
  private blocageMs: number;
  constructor(max = 8, fenetreMs = 10 * 60_000, blocageMs = 15 * 60_000) { this.max = max; this.fenetreMs = fenetreMs; this.blocageMs = blocageMs; }
  bloque(maintenant = Date.now()) { return maintenant < this.bloqueJusqua; }
  /** Enregistre un échec ; renvoie true si cet échec déclenche le blocage. */
  echec(maintenant = Date.now()): boolean {
    this.echecs = this.echecs.filter((t) => maintenant - t < this.fenetreMs);
    this.echecs.push(maintenant);
    if (this.echecs.length >= this.max) { this.bloqueJusqua = maintenant + this.blocageMs; this.echecs = []; return true; }
    return false;
  }
  reussite() { this.echecs = []; }
  finBlocage() { return this.bloqueJusqua; }
}

/** Origines autorisées à appeler la télécommande depuis un navigateur (Rayan's Mobile, et son serveur de test). */
export const ORIGINES = ["https://jojoskeys.github.io", "http://127.0.0.1:4173", "http://localhost:4173"];
