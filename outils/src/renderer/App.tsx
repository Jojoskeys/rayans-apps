import { useEffect, useState } from "react";
import { TOOLS, type ToolId } from "../core/commands.ts";
import type { Goto, State } from "./api-types.ts";
import { api, IconClose, IconGear, IconImage, IconPdf, IconPhone, IconPower, IconSound, IconText, IconWifi, useOutils } from "./shared.tsx";
import { OutilEteins, OutilImage, OutilPdf, OutilSon, OutilTel, OutilTexte, OutilWifi } from "./Tools.tsx";

type Onglet = ToolId | "reglages";
const ICONS: Record<ToolId, () => React.ReactElement> = {
  pdf: () => <IconPdf />, img: () => <IconImage />, tel: () => <IconPhone />, wifi: () => <IconWifi />,
  son: () => <IconSound />, texte: () => <IconText />, eteins: () => <IconPower />,
};

export const accelLabel = (a: string) => a.replace(/Control/g, "Ctrl").replace(/Space/g, "Espace").replace(/\+/g, " + ");

export function App() {
  const s = useOutils();
  const [onglet, setOnglet] = useState<Onglet>("pdf");
  const [goto, setGoto] = useState<Goto | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => api.onGoto((g) => { setGoto({ ...g }); setOnglet(g.tool); }), []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 6000); return () => clearTimeout(id); }, [toast]);
  if (!s) return <div className="chargement">Chargement…</div>;
  const props = { s, goto, notify: setToast };

  return (
    <div className="app">
      <nav className="navigation-principale">
        <div className="marque"><img src="../../assets/icon.png" alt="" width={28} height={28} /><span>Rayan's Outils</span></div>
        {TOOLS.map((t) => (
          <button key={t.id} className={onglet === t.id ? "actif" : ""} onClick={() => { setGoto(null); setOnglet(t.id); }} aria-current={onglet === t.id ? "page" : undefined}>
            {ICONS[t.id]()}<span>{t.title}</span>
            {t.id === "eteins" && s.power && <i className="pastille" />}
            {t.id === "tel" && s.share && <i className="pastille" />}
          </button>
        ))}
        <div className="espace" />
        <button className={onglet === "reglages" ? "actif" : ""} onClick={() => setOnglet("reglages")}><IconGear /><span>Réglages</span></button>
        <p className="raccourci" title="Raccourci de la barre de commande"><kbd>{accelLabel(s.settings.shortcut)}</kbd></p>
      </nav>
      <main className="contenu">
        {onglet === "pdf" && <OutilPdf {...props} />}
        {onglet === "img" && <OutilImage {...props} />}
        {onglet === "tel" && <OutilTel {...props} />}
        {onglet === "wifi" && <OutilWifi {...props} />}
        {onglet === "son" && <OutilSon {...props} />}
        {onglet === "texte" && <OutilTexte {...props} />}
        {onglet === "eteins" && <OutilEteins {...props} />}
        {onglet === "reglages" && <Reglages s={s} notify={setToast} />}
      </main>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button className="icone" onClick={() => setToast(null)} title="Fermer"><IconClose size={16} /></button>
        </div>
      )}
    </div>
  );
}

const SHORTCUTS = ["Control+Alt+Space", "Alt+Space", "Control+Space", "Control+Shift+Space", "Control+Alt+R", "Super+Shift+Space"];

function Reglages({ s, notify }: { s: State; notify: (t: string) => void }) {
  const set = (p: Partial<State["settings"]>) => api.updateSettings(p);
  return (
    <section className="outil">
      <header><h1>Réglages</h1></header>
      <div className="carte pile">
        <h2>Barre de commande</h2>
        <label className="champ-ligne">Raccourci
          <select value={s.settings.shortcut} onChange={async (e) => {
            const r = await set({ shortcut: e.target.value });
            notify(r.shortcutOk ? `Raccourci : ${accelLabel(r.settings.shortcut)}` : `${accelLabel(r.settings.shortcut)} est déjà utilisé par une autre application : choisissez-en un autre.`);
          }}>
            {SHORTCUTS.map((k) => <option key={k} value={k}>{accelLabel(k)}</option>)}
          </select>
        </label>
        {!s.shortcutOk && <p className="erreur">Ce raccourci est pris par une autre application (PowerToys Run utilise Alt + Espace). Choisissez-en un autre.</p>}
        <p className="aide">Commandes : {TOOLS.map((t) => <code key={t.id}>{t.command}</code>).reduce<React.ReactNode[]>((a, c, i) => (i ? [...a, " · ", c] : [c]), [])}. Un clic sur l'icône dans la zone de notification l'ouvre aussi.</p>
      </div>
      <div className="carte pile">
        <h2>Application</h2>
        <label className="case"><input type="checkbox" checked={s.settings.startWithWindows} onChange={(e) => set({ startWithWindows: e.target.checked })} />
          <span>Démarrer avec Windows<small>Pour que le raccourci marche dès l'ouverture de session.</small></span></label>
        <label className="case"><input type="checkbox" checked={s.settings.closeToTray} onChange={(e) => set({ closeToTray: e.target.checked })} />
          <span>Garder dans la zone de notification à la fermeture<small>Sinon, fermer la fenêtre désactive le raccourci.</small></span></label>
        <p className="aide">Données : <code>{s.dataDir}</code></p>
        <div className="actions"><button className="lien" onClick={() => api.openPath(s.dataDir)}>Ouvrir le dossier</button><button className="lien danger" onClick={() => api.quit()}>Quitter l'application</button></div>
        <p className="version">Version {s.version}</p>
      </div>
    </section>
  );
}
