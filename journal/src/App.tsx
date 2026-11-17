import { useCallback, useEffect, useMemo, useState } from "react";
import { api, texteErreur, type EtatVue, type Reglages } from "./api";
import { Activation } from "./Activation";
import { ConversationsView } from "./ConversationsView";
import { JournalView } from "./JournalView";
import { FichiersView } from "./FichiersView";
import { MesJourneesView } from "./MesJourneesView";
import { SecuriteView } from "./SecuriteView";
import { SettingsView } from "./SettingsView";
import { local } from "./format";

type Onglet = "journees" | "journal" | "fichiers" | "securite" | "conversations" | "reglages";

export default function App() {
  const [etat, setEtat] = useState<EtatVue | null>(null);
  const [brouillon, setBrouillon] = useState<Reglages | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("journees");
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurReglages, setErreurReglages] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);
  const [demandeActivation, setDemandeActivation] = useState(false);

  const rafraichir = useCallback(async () => {
    const e = await api.etat();
    setEtat(e);
    return e;
  }, []);

  useEffect(() => {
    rafraichir()
      .then((e) => {
        setBrouillon(e.reglages);
        api.pret();
      })
      .catch((e) => setErreur(texteErreur(e)));
    const t = window.setInterval(() => rafraichir().catch(() => {}), 10_000);
    return () => window.clearInterval(t);
  }, [rafraichir]);

  const modifie = useMemo(() => {
    if (!etat || !brouillon) return false;
    const sans = (r: Reglages) => JSON.stringify({ ...r, collecteActive: null, pauseJusquaMs: null });
    return sans(etat.reglages) !== sans(brouillon);
  }, [etat, brouillon]);

  const appliquer = (e: EtatVue) => {
    setEtat(e);
    setBrouillon((b) => (b ? { ...b, collecteActive: e.reglages.collecteActive, pauseJusquaMs: e.reglages.pauseJusquaMs } : e.reglages));
  };

  const enregistrer = async () => {
    if (!brouillon) return;
    setErreurReglages(null);
    try {
      const e = await api.enregistrerReglages(brouillon);
      setEtat(e);
      setBrouillon(e.reglages);
      setEnregistre(true);
      window.setTimeout(() => setEnregistre(false), 2500);
    } catch (e) {
      setErreurReglages(texteErreur(e));
    }
  };

  if (!etat || !brouillon) return <div className="boot">{erreur ?? "Chargement…"}</div>;

  const r = etat.reglages;
  const statut = !r.collecteActive ? "off" : etat.enPause ? "pause" : "";
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
            <rect x="5" y="4" width="16" height="22" rx="3" fill="#ffb23f" />
            <path d="M9 10h8M9 14h6M9 18h4" stroke="#1b1306" strokeWidth="2" strokeLinecap="round" />
            <circle cx="22" cy="22" r="7" fill="#0b0d12" stroke="#ffb23f" strokeWidth="2" />
            <path d="M22 19v3.4l2 1.4" stroke="#ffb23f" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </svg>
          <div>
            <div className="brand-name">JOURNAL</div>
            <div className="brand-sub">Rayan’s Journal {etat.version}</div>
          </div>
        </div>
        <nav>
          <NavItem label="Mes journées" active={onglet === "journees"} onClick={() => setOnglet("journees")} />
          <NavItem label="Journal d’activité" active={onglet === "journal"} onClick={() => setOnglet("journal")} count={etat.statistiques?.evenements} />
          <NavItem label="Retrouver un fichier" active={onglet === "fichiers"} onClick={() => setOnglet("fichiers")} />
          <NavItem label="Sécurité" active={onglet === "securite"} onClick={() => setOnglet("securite")} />
          <NavItem label="Conversations" active={onglet === "conversations"} onClick={() => setOnglet("conversations")} count={etat.statistiques?.messages} />
          <NavItem label="Réglages" active={onglet === "reglages"} onClick={() => setOnglet("reglages")} />
        </nav>
        <div className="sidebar-foot">
          <div className={"status-line " + statut}>
            <span className="dot" />
            {!r.collecteActive ? "Collecte désactivée" : etat.enPause ? "En pause" : "Collecte active"}
          </div>
          <div className="status-sub">
            {!r.collecteActive
              ? "Rien n’est enregistré dans le journal."
              : etat.enPause
                ? r.pauseJusquaMs && r.pauseJusquaMs < 8e15
                  ? `Jusqu’à ${local(r.pauseJusquaMs)}`
                  : "Jusqu’à reprise manuelle"
                : `Pause : ${etat.raccourci} ou icône près de l’horloge`}
          </div>
          {r.collecteActive ? (
            etat.enPause ? (
              <button className="btn primary small" onClick={async () => appliquer(await api.reprendre())}>Reprendre</button>
            ) : (
              <button className="btn small" onClick={async () => appliquer(await api.pause(null))}>Mettre en pause</button>
            )
          ) : (
            <button className="btn primary small" onClick={() => setDemandeActivation(true)}>Activer la collecte…</button>
          )}
          {r.collecteActive &&
            (r.absentDepuisMs ? (
              <button className="btn small" onClick={async () => appliquer(await api.absence(false))}>Je suis de retour</button>
            ) : (
              <button className="btn small ghost" onClick={async () => appliquer(await api.absence(true))} title="Toute utilisation du PC sera signalée">Je m’absente</button>
            ))}
          {r.absentDepuisMs && <div className="status-sub">Absent depuis {local(r.absentDepuisMs)} : toute utilisation est signalée.</div>}
          <div className="status-sub">Archive chiffrée, sur ce PC uniquement.</div>
        </div>
      </aside>

      <main className="main">
        {modifie && onglet === "reglages" && (
          <div className="savebar">
            <span>Modifications non enregistrées</span>
            {erreurReglages && <span className="bad">{erreurReglages}</span>}
            <div className="row" style={{ marginLeft: "auto" }}>
              <button className="btn ghost" onClick={() => { setBrouillon(etat.reglages); setErreurReglages(null); }}>Abandonner</button>
              <button className="btn primary" onClick={enregistrer}>Enregistrer</button>
            </div>
          </div>
        )}
        {enregistre && <div className="toast">Réglages enregistrés.</div>}
        {etat.erreurArchive && (
          <div className="page" style={{ paddingBottom: 0 }}>
            <div className="alert bad">{etat.erreurArchive}</div>
          </div>
        )}
        {onglet === "journees" && <MesJourneesView etat={etat} onReglages={() => setOnglet("reglages")} />}
        {onglet === "fichiers" && <FichiersView />}
        {onglet === "journal" && <JournalView etat={etat} onActiver={() => setDemandeActivation(true)} />}
        {onglet === "securite" && <SecuriteView etat={etat} onActiver={() => setDemandeActivation(true)} />}
        {onglet === "conversations" && <ConversationsView onChange={() => rafraichir()} />}
        {onglet === "reglages" && (
          <SettingsView
            etat={etat}
            brouillon={brouillon}
            setBrouillon={setBrouillon}
            appliquer={appliquer}
            onActiver={() => setDemandeActivation(true)}
          />
        )}
      </main>
      {demandeActivation && (
        <Activation
          onAnnuler={() => setDemandeActivation(false)}
          onActiver={async () => {
            setDemandeActivation(false);
            appliquer(await api.activerCollecte(true));
          }}
          reglages={r}
        />
      )}
    </div>
  );
}

function NavItem(p: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button className={"nav-item" + (p.active ? " active" : "")} onClick={p.onClick}>
      {p.label}
      {p.count !== undefined && <span className="count">{p.count.toLocaleString("fr-FR")}</span>}
    </button>
  );
}
