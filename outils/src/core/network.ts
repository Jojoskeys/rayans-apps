// Choix de l'adresse IP locale à mettre dans le QR code : celle du Wi-Fi ou de l'Ethernet, pas celle d'une carte
// virtuelle (WSL, Hyper-V, VirtualBox, VPN).

export interface Iface { name: string; address: string; family: string | number; internal: boolean }

const VIRTUAL = /vethernet|virtualbox|vmware|wsl|hyper-?v|loopback|tailscale|zerotier|vpn|docker|bluetooth|npcap/i;
const PRIVATE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

export function pickLanAddress(ifaces: Iface[]): string | null {
  const v4 = ifaces.filter((i) => (i.family === "IPv4" || i.family === 4) && !i.internal && !i.address.startsWith("169.254."));
  const score = (i: Iface) =>
    (PRIVATE.test(i.address) ? 4 : 0) + (VIRTUAL.test(i.name) ? -10 : 0) + (/wi-?fi|wlan|sans fil/i.test(i.name) ? 2 : 0) + (/ethernet/i.test(i.name) ? 1 : 0)
    + (i.address.startsWith("192.168.") ? 1 : 0);
  const best = [...v4].sort((a, b) => score(b) - score(a))[0];
  return best && score(best) > -5 ? best.address : null;
}

/** Nom de fichier sûr pour Windows (reçu du téléphone). */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[<>:"|?*\u0000-\u001f]/g, "_").replace(/^[.\s]+|[.\s]+$/g, "").slice(0, 150);
  const reserved = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;
  return !clean || reserved.test(clean) ? `fichier-${Date.now()}` : clean;
}
