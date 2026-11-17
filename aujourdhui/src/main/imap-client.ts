// Petit client IMAP en lecture seule (TLS), sans dépendance : connexion, ouverture de la boîte de réception en
// lecture seule (EXAMINE : les mails restent « non lus »), recherche des mails récents, lecture de l'expéditeur, puis
// téléchargement des seuls mails des expéditeurs autorisés. Rien n'est jamais modifié, déplacé ni supprimé.
import tls from "node:tls";
import net from "node:net";

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  /** Tests : connexion sans TLS à un faux serveur local. */
  insecure?: boolean;
}

export interface MailBrut { uid: number; source: string }

const TIMEOUT = 30_000;
const MOIS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Chaîne IMAP entre guillemets (antislash et guillemet échappés ; pas de retour à la ligne). */
export function quoted(s: string): string {
  if (/[\r\n]/.test(s)) throw new Error("caractère interdit");
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function dateImap(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()}-${MOIS[d.getMonth()]}-${d.getFullYear()}`;
}

/** Une réponse : lignes non étiquetées (avec le contenu des littéraux {n} intégré) et ligne finale étiquetée. */
interface Reponse { lignes: { texte: string; litteraux: Buffer[] }[]; fin: string }

class Connexion {
  private buf = Buffer.alloc(0);
  private attente: (() => void) | null = null;
  private erreur: Error | null = null;
  private n = 0;
  private sock: net.Socket;
  constructor(sock: net.Socket) {
    this.sock = sock;
    sock.on("data", (d: Buffer) => { this.buf = Buffer.concat([this.buf, d]); this.attente?.(); });
    sock.on("error", (e) => { this.erreur = e; this.attente?.(); });
    sock.on("close", () => { this.erreur ??= new Error("connexion fermée par le serveur"); this.attente?.(); });
    sock.setTimeout(TIMEOUT, () => { this.erreur = new Error("le serveur ne répond pas"); sock.destroy(); });
  }

  private async attendre() {
    if (this.erreur) throw this.erreur;
    await new Promise<void>((r) => { this.attente = () => { this.attente = null; r(); }; });
    if (this.erreur && !this.buf.length) throw this.erreur;
  }

  /** Lit une ligne (CRLF exclu). */
  private async ligne(): Promise<string> {
    for (;;) {
      const i = this.buf.indexOf("\r\n");
      if (i >= 0) { const l = this.buf.subarray(0, i).toString("utf8"); this.buf = this.buf.subarray(i + 2); return l; }
      await this.attendre();
    }
  }

  private async octets(n: number): Promise<Buffer> {
    while (this.buf.length < n) await this.attendre();
    const b = this.buf.subarray(0, n);
    this.buf = this.buf.subarray(n);
    return Buffer.from(b);
  }

  /** Ligne logique complète : suit les littéraux « {n} » en fin de ligne. */
  private async reponseLigne(): Promise<{ texte: string; litteraux: Buffer[] }> {
    let texte = await this.ligne();
    const litteraux: Buffer[] = [];
    for (;;) {
      const m = /\{(\d+)\}$/.exec(texte);
      if (!m) return { texte, litteraux };
      const b = await this.octets(Number(m[1]));
      litteraux.push(b);
      texte += `<littéral ${litteraux.length - 1}>` + (await this.ligne());
    }
  }

  async accueil() {
    const l = await this.reponseLigne();
    if (!/^\* (OK|PREAUTH)/i.test(l.texte)) throw new Error("le serveur n'accepte pas la connexion");
  }

  async commande(cmd: string): Promise<Reponse> {
    const tag = `R${++this.n}`;
    this.sock.write(`${tag} ${cmd}\r\n`);
    const lignes: Reponse["lignes"] = [];
    for (;;) {
      const l = await this.reponseLigne();
      if (l.texte.startsWith(`${tag} `)) {
        if (!/^\S+ OK/i.test(l.texte)) {
          const raison = l.texte.slice(tag.length + 1).replace(/^(NO|BAD)\s*/i, "");
          throw new Error(cmd.startsWith("LOGIN") ? `connexion refusée (${raison.slice(0, 120)})` : `le serveur refuse : ${raison.slice(0, 120)}`);
        }
        return { lignes, fin: l.texte };
      }
      lignes.push(l);
    }
  }

  fermer() { try { this.sock.write("Z LOGOUT\r\n"); } catch { /* */ } this.sock.end(); setTimeout(() => this.sock.destroy(), 1000); }
}

function connecter(cfg: ImapConfig): Promise<net.Socket> {
  return new Promise((ok, ko) => {
    const s = cfg.insecure
      ? net.connect({ host: cfg.host, port: cfg.port }, () => ok(s))
      : tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host }, () => ok(s));
    s.once("error", (e) => ko(new Error(`serveur injoignable (${(e as Error).message})`)));
    s.setTimeout(TIMEOUT, () => { s.destroy(); ko(new Error("le serveur ne répond pas")); });
  });
}

/** Adresse de l'expéditeur dans un en-tête « From: Nom <adresse> ». */
export function expediteur(entete: string): string {
  const deplie = entete.replace(/\r?\n[ \t]+/g, " ");
  const m = /^from:\s*(.*)$/im.exec(deplie);
  const v = m?.[1] ?? "";
  return (/<([^>]+)>/.exec(v)?.[1] ?? v).trim().toLowerCase();
}

/**
 * Lit les mails reçus depuis `depuis` (date seulement) dont l'expéditeur est accepté par `garder`, en ignorant les
 * identifiants déjà vus. Renvoie aussi l'UIDVALIDITY de la boîte (si elle change, les identifiants repartent à zéro).
 */
export async function lireMails(
  cfg: ImapConfig, depuis: number, garder: (adresse: string) => boolean, dejaVus: Set<number>, maxOctets = 2_000_000, max = 50,
): Promise<{ uidValidity: string; mails: MailBrut[]; ignores: number }> {
  const c = new Connexion(await connecter(cfg));
  try {
    await c.accueil();
    await c.commande(`LOGIN ${quoted(cfg.user)} ${quoted(cfg.password)}`);
    const ex = await c.commande("EXAMINE INBOX");
    const uidValidity = ex.lignes.map((l) => /UIDVALIDITY (\d+)/i.exec(l.texte)?.[1]).find(Boolean) ?? "0";
    const rech = await c.commande(`UID SEARCH SINCE ${dateImap(depuis)}`);
    const uids = rech.lignes.flatMap((l) => (/^\* SEARCH\b/i.test(l.texte) ? l.texte.replace(/^\* SEARCH\s*/i, "").split(/\s+/).filter(Boolean).map(Number) : []))
      .filter((u) => Number.isFinite(u) && !dejaVus.has(u)).sort((a, b) => b - a).slice(0, max);
    if (!uids.length) return { uidValidity, mails: [], ignores: 0 };
    // Expéditeur et taille d'abord : seuls les mails des expéditeurs autorisés sont téléchargés.
    const entetes = await c.commande(`UID FETCH ${uids.join(",")} (UID RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM)])`);
    const aLire: number[] = [];
    let ignores = 0;
    for (const l of entetes.lignes) {
      const uid = Number(/UID (\d+)/i.exec(l.texte)?.[1]);
      const taille = Number(/RFC822\.SIZE (\d+)/i.exec(l.texte)?.[1] ?? 0);
      if (!uid) continue;
      if (garder(expediteur(l.litteraux[0]?.toString("utf8") ?? "")) && taille <= maxOctets) aLire.push(uid);
      else ignores++;
    }
    const mails: MailBrut[] = [];
    for (const uid of aLire) {
      const r = await c.commande(`UID FETCH ${uid} (UID BODY.PEEK[])`);
      const l = r.lignes.find((x) => x.litteraux.length);
      if (l) mails.push({ uid, source: l.litteraux[0].toString("utf8") });
    }
    return { uidValidity, mails, ignores };
  } finally {
    c.fermer();
  }
}

/** Vérifie l'adresse, l'identifiant et le mot de passe (connexion puis ouverture de la boîte en lecture seule). */
export async function tester(cfg: ImapConfig): Promise<number> {
  const c = new Connexion(await connecter(cfg));
  try {
    await c.accueil();
    await c.commande(`LOGIN ${quoted(cfg.user)} ${quoted(cfg.password)}`);
    const ex = await c.commande("EXAMINE INBOX");
    return Number(ex.lignes.map((l) => /^\* (\d+) EXISTS/i.exec(l.texte)?.[1]).find(Boolean) ?? 0);
  } finally {
    c.fermer();
  }
}
