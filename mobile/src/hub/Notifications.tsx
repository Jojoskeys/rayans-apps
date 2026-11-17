// Réglage des notifications sur l'iPhone : abonnement Web Push (envoyées par le veilleur en ligne) et choix de ce
// qui est notifié. L'abonnement et les préférences sont synchronisés (fichier « notifications », chiffré).
import { useEffect, useState } from "react";
import { readPlain, store, syncApp } from "../shared/sync.ts";

interface Prefs { cours: boolean; rappels: boolean; matin: boolean; soir: boolean; heureMatin: number; heureSoir: number }
const DEFAULT: Prefs = { cours: true, rappels: true, matin: true, soir: true, heureMatin: 7, heureSoir: 19 };
type NotifData = { subscriptions: { endpoint: string; keys: { p256dh: string; auth: string }; appareil: string; added: number }[]; prefs: Prefs };

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const standalone = () => (navigator as unknown as { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches;
const keyBytes = (b64url: string) => { const s = atob(b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };

async function loadData(): Promise<NotifData> {
  const t = await store.load("notifications");
  try { const d = t ? JSON.parse(t) : {}; return { subscriptions: d.subscriptions ?? [], prefs: { ...DEFAULT, ...(d.prefs ?? {}) } }; } catch { return { subscriptions: [], prefs: { ...DEFAULT } }; }
}
function saveData(d: NotifData) { store.save("notifications", JSON.stringify(d)); }

export function Notifications() {
  const [data, setData] = useState<NotifData | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadData().then(setData);
    if (supported()) void navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setEndpoint(s?.endpoint ?? null));
  }, []);

  if (!supported()) {
    return <section className="carte"><h2>Notifications</h2><p>{standalone() ? "Ton iPhone doit avoir iOS 16.4 ou plus récent pour recevoir des notifications." : "Ouvre Rayan's Mobile depuis son icône sur l'écran d'accueil (pas depuis Safari) pour activer les notifications."}</p></section>;
  }
  if (!data) return null;
  const on = !!endpoint && data.subscriptions.some((s) => s.endpoint === endpoint);

  const activate = async () => {
    setBusy(true); setMsg(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") throw new Error("notifications refusées. Autorise-les dans Réglages → Notifications → Rayan.");
      const pub = await readPlain("vapid-public");
      if (!pub) throw new Error("le veilleur en ligne n'est pas encore configuré (script à lancer une fois sur le PC).");
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(JSON.parse(pub).publicKey) as BufferSource });
      const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const d = await loadData();
      const next = { ...d, subscriptions: [...d.subscriptions.filter((s) => s.endpoint !== j.endpoint), { endpoint: j.endpoint, keys: j.keys, appareil: "iPhone", added: Date.now() }] };
      saveData(next); setData(next); setEndpoint(j.endpoint);
      await syncApp("notifications");
      setMsg("✓ Notifications activées. Les prochaines arriveront au passage du veilleur (toutes les 20 min, de 7 h à 22 h).");
    } catch (e) { setMsg(`✗ ${String((e as Error).message ?? e)}`); } finally { setBusy(false); }
  };
  const deactivate = async () => {
    const reg = await navigator.serviceWorker.ready;
    const s = await reg.pushManager.getSubscription();
    await s?.unsubscribe();
    const d = await loadData();
    const next = { ...d, subscriptions: d.subscriptions.filter((x) => x.endpoint !== endpoint) };
    saveData(next); setData(next); setEndpoint(null);
    setMsg("Notifications désactivées sur ce téléphone.");
  };
  const setPref = (p: Partial<Prefs>) => { const next = { ...data, prefs: { ...data.prefs, ...p } }; setData(next); saveData(next); };
  const test = async () => { const reg = await navigator.serviceWorker.ready; await reg.showNotification("Rayan's Mobile", { body: "Les notifications s'affichent bien sur ce téléphone.", icon: "icon.png" }); };

  return (
    <section className="carte notifs">
      <h2>Notifications</h2>
      <p>Envoyées par le veilleur en ligne, même quand ton PC est éteint : il vérifie ADE et tes rappels toutes les 20 minutes, de 7 h à 22 h.</p>
      {on ? (
        <>
          {([["cours", "Changements de cours (salle, horaire, annulation)"], ["rappels", "Rappels de Ma journée"], ["matin", "Résumé du matin"], ["soir", "Rappel du soir s'il reste des révisions"]] as const).map(([k, label]) => (
            <label key={k} className="case"><input type="checkbox" checked={data.prefs[k]} onChange={(e) => setPref({ [k]: e.target.checked })} /><span>{label}</span></label>
          ))}
          <div className="ligne heures">
            <label>Matin<input type="number" min={5} max={11} value={data.prefs.heureMatin} onChange={(e) => setPref({ heureMatin: Math.min(11, Math.max(5, +e.target.value || 7)) })} /></label>
            <label>Soir<input type="number" min={17} max={22} value={data.prefs.heureSoir} onChange={(e) => setPref({ heureSoir: Math.min(22, Math.max(17, +e.target.value || 19)) })} /></label>
          </div>
          <div className="ligne">
            <button className="bouton secondaire" onClick={() => void test()}>Tester l'affichage</button>
            <button className="lien danger" onClick={() => void deactivate()}>Désactiver sur ce téléphone</button>
          </div>
        </>
      ) : <button className="bouton" disabled={busy} onClick={() => void activate()}>{busy ? "Activation…" : "Activer les notifications"}</button>}
      {msg && <p className={msg.startsWith("✓") ? "ok" : msg.startsWith("✗") ? "ko" : ""}>{msg}</p>}
    </section>
  );
}
