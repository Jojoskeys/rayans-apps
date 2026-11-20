// Fenêtre de Rayan's Télécommande sur le PC : accès, association de l'iPhone, envoi au téléphone, scénarios, sécurité.
import { useEffect, useState } from "react";
import type { Etape, Scenario } from "../core/donnees.ts";
import type { Etat } from "./api-types.ts";

const api = window.telecommande;
const taille = (o: number) => o < 1024 ? `${o} o` : o < 1024 ** 2 ? `${(o / 1024).toFixed(0)} Ko` : o < 1024 ** 3 ? `${(o / 1024 ** 2).toFixed(1)} Mo` : `${(o / 1024 ** 3).toFixed(1)} Go`;
const quand = (t: number) => new Date(t).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function App() {
  const [e, setE] = useState<Etat | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texte: string; lien?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api.etat().then(setE); return api.surEtat(setE); }, []);
  if (!e) return <div className="chargement">Chargement…</div>;

  const d = e.donnees;
  const iphone = e.tailscale.appareils.find((a) => /ios/i.test(a.systeme));
  const pret = e.tailscale.connecte && e.publie && e.serveurOk;

  const activer = async () => {
    setBusy(true); setMsg(null);
    const r = await api.commande({ type: "publier" });
    setBusy(false);
    if (r) setMsg({ ok: r.ok, texte: r.message ?? "", lien: r.lien });
  };

  return (
    <div className="page">
      <header className="entete">
        <div>
          <h1>Rayan's Télécommande</h1>
          <p className="sous">Pilote ce PC depuis ton iPhone, n'importe où, à travers Tailscale.</p>
        </div>
        <span className={`badge ${pret ? "vert" : "orange"}`}>{pret ? "Prêt" : "À configurer"}</span>
      </header>
      {e.avertissement && <p className="alerte">{e.avertissement}</p>}

      <section className="carte">
        <h2>1. Accès depuis l'iPhone</h2>
        <ul className="voyants">
          <li className={e.tailscale.connecte ? "ok" : "ko"}>Tailscale {e.tailscale.connecte ? `connecté (${e.tailscale.proprietaire})` : e.tailscale.installe ? "déconnecté" : "pas installé"}</li>
          <li className={e.serveurOk ? "ok" : "ko"}>Serveur de la télécommande {e.serveurOk ? "démarré" : "arrêté"}</li>
          <li className={e.publie ? "ok" : "ko"}>Publication sécurisée (HTTPS, réseau Tailscale seulement) {e.publie ? "active" : "inactive"}</li>
          {iphone && <li className={iphone.enLigne ? "ok" : "neutre"}>{iphone.nom} {iphone.enLigne ? "en ligne" : `hors ligne${iphone.vuA ? ` (vu ${quand(iphone.vuA)})` : ""}`}</li>}
        </ul>
        {!e.publie && e.tailscale.connecte && (
          <>
            {!e.tailscale.httpsActive && <p className="aide">Avant d'activer : sur <b>login.tailscale.com → DNS</b>, en bas de la page, clique sur <b>Enable HTTPS</b>. C'est ce qui donne à ton PC une adresse sécurisée que l'iPhone accepte. (Le nom de ton PC et de ton réseau Tailscale apparaîtra dans le registre public des certificats ; rien d'autre.)</p>}
            <div className="ligne">
              {!e.tailscale.httpsActive && <button className="bouton secondaire" onClick={() => void api.commande({ type: "ouvrir-lien", url: "https://login.tailscale.com/admin/dns" })}>Ouvrir la console Tailscale</button>}
              <button className="bouton" disabled={busy} onClick={() => void activer()} data-testid="activer">{busy ? "Activation…" : "Activer l'accès depuis l'iPhone"}</button>
            </div>
          </>
        )}
        {e.publie && <div className="ligne"><button className="lien danger" onClick={() => void api.commande({ type: "depublier" })}>Couper l'accès depuis l'iPhone</button></div>}
        {msg && <p className={msg.ok ? "ok" : "ko"}>{msg.texte} {msg.lien && <button className="lien" onClick={() => void api.commande({ type: "ouvrir-lien", url: msg.lien! })}>Ouvrir le lien</button>}</p>}
      </section>

      <Association e={e} />
      <Boite e={e} />
      <Scenarios scenarios={d.scenarios} />

      <section className="carte">
        <h2>Sécurité et options</h2>
        <label className="case"><input type="checkbox" checked={d.reglages.demarrerAvecWindows} onChange={(x) => void api.commande({ type: "reglages", patch: { demarrerAvecWindows: x.target.checked } })} /><span>Démarrer avec Windows (sinon, la télécommande ne répond pas après un redémarrage tant que tu n'as pas ouvert ta session)</span></label>
        <label className="case"><input type="checkbox" checked={d.reglages.notifierConnexion} onChange={(x) => void api.commande({ type: "reglages", patch: { notifierConnexion: x.target.checked } })} /><span>Prévenir sur le PC quand le téléphone se connecte</span></label>
        <label className="case"><input type="checkbox" checked={d.reglages.autoriserArret} onChange={(x) => void api.commande({ type: "reglages", patch: { autoriserArret: x.target.checked } })} /><span><b>Autoriser l'arrêt complet depuis le téléphone.</b> Ton PC est en Wi-Fi : une fois éteint, il ne peut <b>pas</b> être rallumé à distance.</span></label>
        <label className="case"><input type="checkbox" checked={d.reglages.autoriserVeille} onChange={(x) => void api.commande({ type: "reglages", patch: { autoriserVeille: x.target.checked } })} /><span><b>Autoriser la mise en veille depuis le téléphone.</b> Même limite : il faudra toucher la souris ou le clavier pour le réveiller.</span></label>
        <p className="aide">Téléphone perdu : clique sur « Nouveau code » plus haut (le téléphone est déconnecté de la télécommande), puis retire-le dans la console Tailscale (Machines → ⋯ → Remove) : il perd tout accès au PC.</p>
        <div className="ligne">
          <button className="bouton secondaire" onClick={() => void api.commande({ type: "ouvrir-lien", url: "https://www.icloud.com/find" })}>Faire sonner l'iPhone (iCloud)</button>
          <button className="bouton secondaire" onClick={() => void api.commande({ type: "ouvrir-reception" })}>Ouvrir les fichiers reçus</button>
        </div>
      </section>

      <section className="carte">
        <h2>Journal</h2>
        {d.journal.length === 0 ? <p className="vide">Rien pour l'instant.</p> : (
          <ul className="journal">{[...d.journal].reverse().slice(0, 40).map((j, i) => <li key={i}><time>{quand(j.at)}</time> {j.quoi}{j.detail ? <span className="detail"> · {j.detail}</span> : null}</li>)}</ul>
        )}
      </section>
      <p className="version">Version {e.version} · Fichiers reçus : <code>{e.dossierReception}</code></p>
    </div>
  );
}

function Association({ e }: { e: Etat }) {
  const [voir, setVoir] = useState(false);
  const [voirMontre, setVoirMontre] = useState(false);
  return (
    <section className="carte">
      <h2>2. Associer l'iPhone</h2>
      <ol className="etapes">
        <li>Sur l'iPhone, ouvre <b>Rayan's Mobile</b> → tuile <b>Télécommande</b>.</li>
        <li>Adresse du PC : <code className="gros">{e.tailscale.adresse ?? "—"}</code></li>
        <li>Code : <code className="gros" data-testid="code">{voir ? e.donnees.code : "•••••-•••••-•••••-•••••"}</code> <button className="lien" onClick={() => setVoir(!voir)}>{voir ? "Masquer" : "Afficher"}</button></li>
      </ol>
      <p className="aide">Le code reste sur ce PC et sur ton iPhone. « Nouveau code » déconnecte immédiatement tous les téléphones déjà associés.</p>
      <button className="lien danger" onClick={() => { if (confirm("Créer un nouveau code ? Les téléphones associés devront retaper le nouveau code.")) void api.commande({ type: "nouveau-code" }); }}>Nouveau code</button>
      <h3>Montre Garmin (Rayan's Montre)</h3>
      <ul className="etapes">
        <li>Code montre : <code className="gros" data-testid="code-montre">{voirMontre ? e.donnees.codeMontre : "•••••-•••••-•••••-•••••"}</code> <button className="lien" onClick={() => setVoirMontre(!voirMontre)}>{voirMontre ? "Masquer" : "Afficher"}</button></li>
      </ul>
      <p className="aide">À recopier avec l'adresse dans <code>garmin\montre\config.local.json</code> (jamais dans le dépôt), puis réinstaller l'app. Ce code ne permet QUE d'envoyer les saisies de la montre : rien d'autre sur le PC.</p>
      <button className="lien danger" onClick={() => { if (confirm("Créer un nouveau code montre ? Il faudra le recopier dans config.local.json et réinstaller l'app sur la montre.")) void api.commande({ type: "nouveau-code-montre" }); }}>Nouveau code montre</button>
    </section>
  );
}

function Boite({ e }: { e: Etat }) {
  const [texte, setTexte] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section className="carte">
      <h2>Envoyer au téléphone</h2>
      <p className="aide">Dépose ici des fichiers ou un texte : ils t'attendent sur l'iPhone dans Télécommande → Fichiers → <b>Depuis le PC</b>.</p>
      <div className="ligne">
        <button className="bouton" onClick={() => void api.commande({ type: "envoyer-fichiers" }).then((r) => setMsg(r?.message ?? null))}>Choisir des fichiers…</button>
      </div>
      <div className="ligne">
        <textarea value={texte} onChange={(x) => setTexte(x.target.value)} placeholder="Un lien, une adresse, un texte à copier sur le téléphone…" rows={2} />
        <button className="bouton secondaire" disabled={!texte.trim()} onClick={() => void api.commande({ type: "envoyer-texte", texte }).then((r) => { setMsg(r?.message ?? null); setTexte(""); })}>Envoyer le texte</button>
      </div>
      {msg && <p className="ok">{msg}</p>}
      {e.donnees.boite.length > 0 && (
        <ul className="boite">{e.donnees.boite.map((b) => (
          <li key={b.id}><span>{b.type === "texte" ? "📝" : "📄"} {b.nom}</span><small>{taille(b.taille)} · {quand(b.at)}</small><button className="lien danger" onClick={() => void api.commande({ type: "supprimer-boite", id: b.id })}>Retirer</button></li>
        ))}</ul>
      )}
    </section>
  );
}

function Scenarios({ scenarios }: { scenarios: Scenario[] }) {
  const [liste, setListe] = useState(scenarios);
  useEffect(() => setListe(scenarios), [scenarios]);
  const enregistrer = (l: Scenario[]) => { setListe(l); void api.commande({ type: "scenarios", scenarios: l }); };
  const maj = (i: number, s: Scenario) => enregistrer(liste.map((x, j) => (j === i ? s : x)));
  const ajouterOuvrir = async (i: number, dossier: boolean) => {
    const r = await api.commande({ type: "choisir-cible", dossier });
    if (r?.cible) maj(i, { ...liste[i], etapes: [...liste[i].etapes, { type: "ouvrir", cible: r.cible, nom: r.nom ?? r.cible }] });
  };
  // Saisie en cours dans un scénario (prompt() n'existe pas dans Electron).
  const [saisie, setSaisie] = useState<{ i: number; type: "lien" | "fermer"; valeur: string } | null>(null);
  const valider = () => {
    if (!saisie) return;
    const v = saisie.valeur.trim(), s = liste[saisie.i];
    if (saisie.type === "lien") {
      if (!/^https?:\/\/\S+$/i.test(v)) return;
      maj(saisie.i, { ...s, etapes: [...s.etapes, { type: "ouvrir", cible: v, nom: v.replace(/^https?:\/\//, "").slice(0, 40) }] });
    } else {
      if (!/^[\w .()+-]{1,80}$/.test(v)) return;
      maj(saisie.i, { ...s, etapes: [...s.etapes, { type: "fermer", processus: v.replace(/\.exe$/i, "") }] });
    }
    setSaisie(null);
  };
  const decrire = (x: Etape) => x.type === "ouvrir" ? `Ouvrir ${x.nom}` : `Fermer ${x.processus}`;
  return (
    <section className="carte">
      <h2>Scénarios</h2>
      <p className="aide">Un bouton sur l'iPhone qui enchaîne plusieurs actions sur le PC. Exemple : « Préparer pour travailler » ouvre VS Code, ton dossier de cours et Rayan's Chrono, et ferme Discord et Steam.</p>
      {liste.map((s, i) => (
        <div key={s.id} className="scenario">
          <div className="ligne">
            <input className="icone" value={s.icone} onChange={(x) => maj(i, { ...s, icone: x.target.value })} maxLength={4} />
            <input value={s.nom} onChange={(x) => maj(i, { ...s, nom: x.target.value })} />
            <button className="lien danger" onClick={() => { if (confirm(`Supprimer « ${s.nom} » ?`)) enregistrer(liste.filter((_, j) => j !== i)); }}>Supprimer</button>
          </div>
          <ol className="etapes-scenario">
            {s.etapes.map((x, k) => (
              <li key={k}>{decrire(x)} <button className="lien danger" onClick={() => maj(i, { ...s, etapes: s.etapes.filter((_, m) => m !== k) })}>×</button></li>
            ))}
            {!s.etapes.length && <li className="vide">Aucune étape.</li>}
          </ol>
          <div className="ligne petite">
            <button className="bouton secondaire" onClick={() => void ajouterOuvrir(i, false)}>+ Programme ou fichier</button>
            <button className="bouton secondaire" onClick={() => void ajouterOuvrir(i, true)}>+ Dossier</button>
            <button className="bouton secondaire" onClick={() => setSaisie({ i, type: "lien", valeur: "https://" })}>+ Site web</button>
            <button className="bouton secondaire" onClick={() => setSaisie({ i, type: "fermer", valeur: "" })}>+ Fermer un programme</button>
          </div>
          {saisie?.i === i && (
            <div className="ligne">
              <input autoFocus value={saisie.valeur} onChange={(x) => setSaisie({ ...saisie, valeur: x.target.value })} onKeyDown={(x) => { if (x.key === "Enter") valider(); if (x.key === "Escape") setSaisie(null); }}
                placeholder={saisie.type === "lien" ? "https://…" : "Nom du programme, comme dans le Gestionnaire des tâches (ex. Discord, steam, chrome)"} style={{ flex: 1 }} />
              <button className="bouton" onClick={valider}>Ajouter</button>
              <button className="lien" onClick={() => setSaisie(null)}>Annuler</button>
            </div>
          )}
        </div>
      ))}
      <button className="bouton secondaire" onClick={() => enregistrer([...liste, { id: `s${Date.now().toString(36)}`, nom: "Nouveau scénario", icone: "▶", etapes: [] }])}>+ Nouveau scénario</button>
    </section>
  );
}
