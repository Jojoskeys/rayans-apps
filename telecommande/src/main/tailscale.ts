// Tailscale : état du réseau privé, compte propriétaire et publication HTTPS de la télécommande (« tailscale serve »).
import fs from "node:fs";
import path from "node:path";
import { executer } from "./systeme.ts";

export const PORT = 47321;

const EXE = [
  path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Tailscale", "tailscale.exe"),
  path.join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Tailscale", "tailscale.exe"),
].find((p) => fs.existsSync(p));

export const tailscaleInstalle = () => !!EXE;

export interface Appareil { nom: string; systeme: string; enLigne: boolean; vuA: number | null; ip: string }
export interface EtatTailscale {
  installe: boolean;
  connecte: boolean;
  proprietaire: string | null;
  adresse: string | null;       // https://rayan.tailxxxx.ts.net
  httpsActive: boolean;          // certificats HTTPS autorisés dans la console
  appareils: Appareil[];
}

export async function etatTailscale(): Promise<EtatTailscale> {
  const vide: EtatTailscale = { installe: !!EXE, connecte: false, proprietaire: null, adresse: null, httpsActive: false, appareils: [] };
  if (!EXE) return vide;
  try {
    const j = JSON.parse(await executer(EXE, ["status", "--json"], 10_000));
    const self = j.Self ?? {};
    const users = j.User ?? {};
    const proprietaire = users[String(self.UserID)]?.LoginName ?? null;
    const dns = String(self.DNSName ?? "").replace(/\.$/, "");
    const appareils: Appareil[] = Object.values(j.Peer ?? {}).map((p) => {
      const x = p as Record<string, unknown>;
      const vu = typeof x.LastSeen === "string" && !x.LastSeen.startsWith("0001") ? Date.parse(x.LastSeen) : null;
      // iOS annonce « localhost » comme HostName : le nom DNS (iphone-13-pro-max.tail….ts.net) est plus parlant.
      const dnsNom = typeof x.DNSName === "string" ? x.DNSName.split(".")[0] : "";
      return { nom: dnsNom || String(x.HostName ?? "?"), systeme: String(x.OS ?? ""), enLigne: !!x.Online, vuA: vu, ip: Array.isArray(x.TailscaleIPs) ? String(x.TailscaleIPs[0]) : "" };
    });
    return {
      installe: true,
      connecte: j.BackendState === "Running",
      proprietaire,
      adresse: dns ? `https://${dns}` : null,
      httpsActive: Array.isArray(j.CertDomains) && j.CertDomains.length > 0,
      appareils,
    };
  } catch { return vide; }
}

/** La télécommande est-elle publiée par « tailscale serve » vers notre port ? */
export async function servePublie(): Promise<boolean> {
  if (!EXE) return false;
  try { return (await executer(EXE, ["serve", "status", "--json"], 10_000)).includes(`127.0.0.1:${PORT}`); } catch { return false; }
}

/**
 * Publie la télécommande en HTTPS sur le réseau Tailscale seulement (jamais sur Internet : c'est « serve », pas « funnel »).
 * Si les certificats HTTPS ne sont pas autorisés, Tailscale renvoie un lien vers la console : on le rend.
 */
export async function publier(): Promise<{ ok: boolean; lien?: string; message: string }> {
  if (!EXE) return { ok: false, message: "Tailscale n'est pas installé." };
  try {
    const sortie = await executer(EXE, ["serve", "--bg", "--yes", "--https=443", `http://127.0.0.1:${PORT}`], 25_000);
    if (await servePublie()) return { ok: true, message: "Accès depuis l'iPhone activé." };
    const lien = sortie.match(/https:\/\/login\.tailscale\.com\/\S+/)?.[0];
    return { ok: false, lien, message: lien ? "Autorise d'abord les certificats HTTPS dans la console Tailscale." : sortie.trim().slice(0, 300) };
  } catch (e) {
    const m = String((e as Error).message ?? e);
    const lien = m.match(/https:\/\/login\.tailscale\.com\/\S+/)?.[0];
    return { ok: false, lien, message: lien ? "Autorise d'abord les certificats HTTPS dans la console Tailscale." : m.slice(0, 300) };
  }
}

export async function depublier() {
  if (!EXE) return;
  await executer(EXE, ["serve", "--https=443", "off"], 15_000).catch(() => "");
}
