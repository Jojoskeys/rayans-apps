// Vidéos en ligne : le veilleur lit le flux public de chaque chaîne YouTube (aucune clé, aucun abonnement) et
// prévient l'iPhone dès qu'une nouvelle vidéo apparaît. Metricool publie sur tous les réseaux au même moment, donc
// la vidéo est aussi sur TikTok, Instagram… : la notification ouvre une page avec les liens à partager.
// Comptes à surveiller : secret VIDEOS_COMPTES (JSON écrit par veilleur/videos.ps1), jamais dans le code.
import type { Message } from "./plan.ts";

export interface Compte { nom: string; youtube: string; tiktok?: string; instagram?: string; facebook?: string }
export interface VideoYoutube { id: string; titre: string; publiee: number }

/** On ne prévient que pour une vidéo sortie dans les 12 dernières heures (pas de rattrapage au premier passage). */
export const FENETRE = 12 * 3_600_000;

const entites = (s: string) => s.replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Flux Atom d'une chaîne → vidéos (identifiant, titre, date de publication). */
export function lireFlux(xml: string): VideoYoutube[] {
  const out: VideoYoutube[] = [];
  for (const e of xml.split("<entry>").slice(1)) {
    const id = /<yt:videoId>([\w-]+)<\/yt:videoId>/.exec(e)?.[1];
    const titre = /<title>([\s\S]*?)<\/title>/.exec(e)?.[1];
    const publiee = Date.parse(/<published>([^<]+)<\/published>/.exec(e)?.[1] ?? "");
    if (id && Number.isFinite(publiee)) out.push({ id, titre: entites(titre ?? "").trim() || "Ma nouvelle vidéo", publiee });
  }
  return out;
}

/** Liens à partager : la vidéo YouTube, puis les profils des autres réseaux. */
export function liens(c: Compte, v: VideoYoutube): { network: string; url: string }[] {
  const l = [{ network: "youtube", url: `https://www.youtube.com/shorts/${v.id}` }];
  const pseudo = (s: string) => encodeURIComponent(s.replace(/^@/, "").trim());
  if (c.tiktok) l.push({ network: "tiktok", url: `https://www.tiktok.com/@${pseudo(c.tiktok)}` });
  if (c.instagram) l.push({ network: "instagram", url: `https://www.instagram.com/${pseudo(c.instagram)}/` });
  if (c.facebook) l.push({ network: "facebook", url: /^\d+$/.test(c.facebook) ? `https://www.facebook.com/profile.php?id=${c.facebook}` : `https://www.facebook.com/${pseudo(c.facebook)}` });
  return l;
}

export function lienPartage(titre: string, ls: { network: string; url: string }[]): string {
  const q = new URLSearchParams({ "en-ligne": titre });
  for (const l of ls) q.append("l", `${l.network}~${l.url}`);
  return `./studio/?${q}`;
}

/** Une notification par vidéo sortie depuis moins de 12 h. */
export function videosEnLigne(c: Compte, videos: VideoYoutube[], now: number): { key: string; m: Message }[] {
  return videos.filter((v) => v.publiee <= now + 5 * 60_000 && v.publiee >= now - FENETRE).map((v) => ({
    key: `video|${new Date(v.publiee).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" })}|${v.id}`,
    m: {
      title: `🎉 Nouvelle vidéo ${c.nom} en ligne`.replace("  ", " "),
      body: `« ${v.titre} »\nTouche pour partager le lien à ta famille et tes amis.`,
      url: lienPartage(v.titre, liens(c, v)),
      tag: `video-${v.id}`,
    },
  }));
}

/** Secret VIDEOS_COMPTES → comptes valides (chaîne YouTube « UC… » obligatoire). */
export function lireComptes(s: string): Compte[] {
  let l: unknown;
  try { l = JSON.parse(s); } catch { return []; }
  if (!Array.isArray(l)) return [];
  return l.filter((c): c is Compte => !!c && typeof c === "object" && typeof (c as Compte).youtube === "string" && /^UC[\w-]{22}$/.test((c as Compte).youtube))
    .map((c) => ({ ...c, nom: typeof c.nom === "string" ? c.nom.trim() : "" }));
}

/** Télécharge le flux public de la chaîne. */
export async function telechargerFlux(chaine: string, base = "https://www.youtube.com"): Promise<VideoYoutube[]> {
  const r = await fetch(`${base}/feeds/videos.xml?channel_id=${encodeURIComponent(chaine)}`, { signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`YouTube répond ${r.status}`);
  return lireFlux(await r.text());
}
