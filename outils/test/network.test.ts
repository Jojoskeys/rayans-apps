import { test } from "node:test";
import assert from "node:assert/strict";
import { pickLanAddress, safeFileName } from "../src/core/network.ts";

const i = (name: string, address: string, family: string | number = "IPv4", internal = false) => ({ name, address, family, internal });

test("adresse locale : le Wi-Fi plutôt que WSL, Hyper-V ou un VPN", () => {
  assert.equal(pickLanAddress([
    i("vEthernet (WSL)", "172.20.48.1"), i("Loopback Pseudo-Interface 1", "127.0.0.1", "IPv4", true),
    i("Wi-Fi", "192.168.1.42"), i("Wi-Fi", "fe80::1", "IPv6"), i("Tailscale", "100.64.0.3"),
  ]), "192.168.1.42");
  assert.equal(pickLanAddress([i("Ethernet", "10.0.0.5"), i("Ethernet 2", "169.254.10.1")]), "10.0.0.5");
  assert.equal(pickLanAddress([i("Ethernet", "192.168.0.10", 4)]), "192.168.0.10"); // family numérique (Node ≥ 18.0)
  assert.equal(pickLanAddress([i("vEthernet (WSL)", "172.20.48.1")]), null);
  assert.equal(pickLanAddress([]), null);
});

test("nom de fichier reçu du téléphone", () => {
  assert.equal(safeFileName("IMG_0001.HEIC"), "IMG_0001.HEIC");
  assert.equal(safeFileName("../../Windows/system32/x.dll"), "x.dll");
  assert.equal(safeFileName("a:b*c?.jpg"), "a_b_c_.jpg");
  assert.match(safeFileName("CON"), /^fichier-\d+$/);
  assert.match(safeFileName(""), /^fichier-\d+$/);
  assert.equal(safeFileName("..\\..\\photo.jpg"), "photo.jpg");
});
