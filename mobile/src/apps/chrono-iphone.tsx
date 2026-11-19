// Rayan's Chrono sur l'iPhone, écran éteint. Une web app est mise en pause quand l'écran s'éteint, donc :
//  - « Minuteur iPhone » lance un raccourci (app Raccourcis → « Démarrer un minuteur ») : le vrai minuteur de
//    l'iPhone, visible sur l'écran verrouillé, avec sa sonnerie ;
//  - « Prévenir à la fin » confie la fin du minuteur au PC (Rayan's Télécommande, par Tailscale), qui envoie une
//    notification Web Push à l'heure prévue. Abonnement à part (service « sw-push.js ») : celui des autres
//    notifications utilise la clé du veilleur en ligne, que le PC n'a pas.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { remaining } from "../../../chrono/src/core/engine.ts";
import type { AppData } from "../../../chrono/src/core/types.ts";
import { finPrevue, lienRaccourci, messageFin } from "../shared/chrono-iphone.ts";
import { appel, lireConfig } from "../shared/pc.ts";

interface Prefs { prevenir: boolean; raccourci: string }
const CLE = "rm-chrono-iphone";
const lirePrefs = (): Prefs => { try { return { prevenir: false, raccourci: "Chrono Rayan", ...JSON.parse(localStorage.getItem(CLE) ?? "{}") }; } catch { return { prevenir: false, raccourci: "Chrono Rayan" }; } };
const ecrirePrefs = (p: Prefs) => { try { localStorage.setItem(CLE, JSON.stringify(p)); } catch { /* stockage indisponible */ } };

// ----- Abonnement Web Push propre au Chrono -----
const pushPossible = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const octets = (b64url: string) => { const s = atob(b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
const memeCle = (sub: PushSubscription, cle: string) => {
  const k = sub.options?.applicationServerKey;
  if (!k) return true;
  const a = new Uint8Array(k), b = octets(cle);
  return a.length === b.length && a.every((x, i) => x === b[i]);
};
let enregistrement: Promise<ServiceWorkerRegistration> | null = null;
const service = () => (enregistrement ??= navigator.serviceWorker.register("./sw-push.js", { scope: "./push/", updateViaCache: "none" }));
const abonnementActuel = async () => pushPossible() ? (await service()).pushManager.getSubscription() : null;

// ----- Rappel programmé sur le PC -----
let envoye: { fin: number | null } = { fin: null };
try { envoye = JSON.parse(localStorage.getItem(`${CLE}-envoye`) ?? '{"fin":null}'); } catch { /* rien */ }
let attente: ReturnType<typeof setTimeout> | null = null;
let dernier: AppData | null = null;
const etatL = new Set<(m: string | null) => void>();
const signaler = (m: string | null) => { for (const l of etatL) l(m); };

/** Appelé à chaque changement du minuteur : programme ou annule la notification sur le PC. */
export function suivre(d: AppData) {
  dernier = d;
  const voulu = lirePrefs().prevenir ? finPrevue(d) : null;
  if (voulu === envoye.fin) return;
  if (attente) clearTimeout(attente);
  attente = setTimeout(() => void synchroniser(d, voulu), 300);
}

async function synchroniser(d: AppData, fin: number | null) {
  const cfg = lireConfig();
  try {
    const sub = await abonnementActuel();
    if (!cfg || !sub) throw new Error("Notification de fin pas encore activée sur ce téléphone.");
    if (fin !== null) await appel(cfg, "/api/chrono/programmer", { corps: { abonnement: sub.toJSON(), dansMs: Math.max(0, fin - Date.now()), ...messageFin(d) } });
    else await appel(cfg, "/api/chrono/annuler", { corps: { endpoint: sub.endpoint } });
    envoye = { fin };
    try { localStorage.setItem(`${CLE}-envoye`, JSON.stringify(envoye)); } catch { /* rien */ }
    signaler(null);
  } catch (e) {
    signaler(fin !== null ? `⚠︎ Rappel non programmé : ${(e as Error).message}` : null);
  }
}
// Au retour dans l'app : réessaie si le PC n'avait pas répondu.
addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && dernier) suivre(dernier); });

// ----- Panneau -----
function Panneau({ lire, demarrer }: { lire: () => AppData; demarrer: () => void }) {
  const [prefs, setPrefs] = useState(lirePrefs);
  const [ouvert, setOuvert] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  // Préparé d'avance : sur iPhone, l'abonnement doit partir juste après le toucher.
  const [cle, setCle] = useState<string | null>(null);
  const cfg = lireConfig();
  useEffect(() => {
    // Un rappel bien programmé n'efface que l'alerte d'échec précédente, pas les autres messages.
    const l = (m: string | null) => setMsg((cur) => m ?? (cur?.startsWith("⚠︎") ? null : cur));
    etatL.add(l); return () => { etatL.delete(l); };
  }, []);
  useEffect(() => {
    if (!cfg || !pushPossible()) return;
    void service().catch(() => {});
    void appel<{ cle: string }>(cfg, "/api/chrono/cle").then((r) => setCle(r.cle)).catch(() => setCle(null));
  }, []);
  const changer = (p: Partial<Prefs>) => { const n = { ...prefs, ...p }; setPrefs(n); ecrirePrefs(n); suivre(lire()); };

  const minuteurIphone = () => {
    const d = lire();
    if (d.timer.mode !== "pomodoro") { setMsg("Le minuteur iPhone marche en mode Pomodoro."); return; }
    if (d.timer.status !== "marche") demarrer();
    location.href = lienRaccourci(prefs.raccourci, remaining(lire().timer, Date.now()) / 1000);
  };

  const activer = async () => {
    if (prefs.prevenir) { changer({ prevenir: false }); setMsg("Notification de fin désactivée."); return; }
    if (!cfg) { setMsg("Associe d'abord le PC dans la tuile Télécommande (adresse et code), puis reviens ici."); return; }
    if (!pushPossible()) { setMsg("Ouvre Rayan's Mobile depuis son icône sur l'écran d'accueil (iOS 16.4 ou plus) pour activer les notifications."); return; }
    if (!cle) { setMsg("Le PC n'a pas répondu : vérifie Tailscale et que Rayan's Télécommande (version 1.3 ou plus) tourne, puis réessaie."); return; }
    setOccupe(true); setMsg(null);
    try {
      const r = await service();
      let sub = await r.pushManager.getSubscription();
      if (sub && !memeCle(sub, cle)) { await sub.unsubscribe(); sub = null; }
      sub ??= await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: octets(cle) as BufferSource });
      await appel(cfg, "/api/chrono/essai", { corps: { abonnement: sub.toJSON() } });
      changer({ prevenir: true });
      setMsg("✓ Activé. Une notification d'essai arrive. Le PC te préviendra à la fin de chaque minuteur, même écran éteint.");
    } catch (e) {
      const m = String((e as Error).message ?? e);
      setMsg(`✗ ${/denied|not allowed|permission/i.test(m) || Notification.permission === "denied" ? "notifications refusées. Autorise-les dans Réglages → Notifications → Rayan, puis réessaie." : m}`);
    } finally { setOccupe(false); }
  };

  return (
    <div id="rm-chrono-iphone">
      {(ouvert || msg) && (
        <div className="rci-carte">
          {msg && <p className="msg">{msg}</p>}
          {ouvert && <>
            <h3>Voir le temps sur l'écran verrouillé</h3>
            <p>Une web app ne peut pas s'afficher sur l'écran verrouillé. Le bouton « ⏱ iPhone » lance le vrai minuteur de l'iPhone avec le temps restant. À faire une seule fois :</p>
            <ol>
              <li>Ouvre l'app <b>Raccourcis</b> → <b>+</b> (nouveau raccourci).</li>
              <li>Ajoute l'action <b>Démarrer un minuteur</b>.</li>
              <li>Touche la durée → <b>Entrée du raccourci</b>, et choisis l'unité <b>secondes</b>.</li>
              <li>Nomme le raccourci exactement : <input value={prefs.raccourci} onChange={(e) => changer({ raccourci: e.target.value })} aria-label="Nom du raccourci" /></li>
            </ol>
            <p className="rci-note">La première fois, l'iPhone demande d'autoriser le raccourci. Si tu mets en pause ici, pense à arrêter aussi le minuteur iPhone.</p>
            <h3>Être prévenu à la fin</h3>
            <p className="rci-note">Ton PC (Rayan's Télécommande) envoie la notification à l'heure prévue, même app fermée. Il faut juste qu'il soit allumé avec la Télécommande lancée.</p>
          </>}
        </div>
      )}
      <div className="barre">
        <button onClick={minuteurIphone} title="Lancer le minuteur de l'iPhone">⏱ iPhone</button>
        <button className={prefs.prevenir ? "actif" : ""} onClick={() => void activer()} disabled={occupe} aria-pressed={prefs.prevenir} title="Notification de fin envoyée par le PC">{prefs.prevenir ? "🔔 Prévenu" : "🔕 Prévenir"}</button>
        <button onClick={() => { setOuvert(!ouvert); if (ouvert) setMsg(null); }} aria-expanded={ouvert} title="Aide">{ouvert || msg ? "✕" : "?"}</button>
      </div>
    </div>
  );
}

const CSS = `
#rm-chrono-iphone { position: fixed; z-index: 2147482000; right: max(10px, env(safe-area-inset-right)); bottom: calc(env(safe-area-inset-bottom) + 10px);
  left: calc(max(10px, env(safe-area-inset-left)) + 54px); display: flex; flex-direction: column; align-items: flex-end; gap: 8px; font: 15px/1.4 system-ui; color: #ECEFF3; pointer-events: none; }
#rm-chrono-iphone > * { pointer-events: auto; }
#rm-chrono-iphone .barre { display: flex; gap: 6px; }
#rm-chrono-iphone button { height: 44px; min-width: 44px; padding: 0 14px; border-radius: 99px; border: 1px solid #2B313B; background: rgba(24,28,34,.92); color: inherit; font: inherit; box-shadow: 0 6px 18px rgba(0,0,0,.35); }
#rm-chrono-iphone button.actif { border-color: #3BA776; color: #7FDCAA; }
#rm-chrono-iphone .rci-carte { max-width: 420px; max-height: 60vh; overflow: auto; background: #181C22; border: 1px solid #2B313B; border-radius: 14px; padding: 12px 14px; box-shadow: 0 10px 30px rgba(0,0,0,.45); }
#rm-chrono-iphone h3 { margin: 4px 0 6px; font-size: 15px; text-transform: none; letter-spacing: 0; color: inherit; } #rm-chrono-iphone p, #rm-chrono-iphone ol { margin: 0 0 8px; } #rm-chrono-iphone ol { padding-left: 20px; }
#rm-chrono-iphone .rci-note { color: #A5ADBA; font-size: 13px; } #rm-chrono-iphone .msg { font-weight: 600; }
#rm-chrono-iphone input { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 6px 8px; border-radius: 8px; border: 1px solid #2B313B; background: #111418; color: inherit; font: inherit; }
body { padding-bottom: calc(env(safe-area-inset-bottom) + 72px); }`;

export function monterPanneau(lire: () => AppData, demarrer: () => void) {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);
  const div = document.createElement("div");
  document.body.append(div);
  createRoot(div).render(<Panneau lire={lire} demarrer={demarrer} />);
}
