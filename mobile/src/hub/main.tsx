// Rayan's Mobile : écran d'accueil (une tuile par app) et réglages de la synchronisation.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getConfig, onStatus, setConfig, setupKey, syncApp, testConfig, type SyncStatus } from "../shared/sync.ts";
import { APPS } from "../shared/apps.ts";
import "./hub.css";

function Hub() {
  const [page, setPage] = useState<"accueil" | "synchro">(getConfig() ? "accueil" : "synchro");
  const [st, setSt] = useState<SyncStatus | null>(null);
  useEffect(() => onStatus(setSt), []);
  const heure = new Date().getHours();
  return (
    <div className="hub">
      <header>
        <div>
          <p className="sous">{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1>{heure < 18 ? "Bonjour Rayan" : "Bonsoir Rayan"}</h1>
        </div>
        <button className={`pastille ${st?.state ?? ""}`} onClick={() => setPage(page === "synchro" ? "accueil" : "synchro")} aria-label="Synchronisation">
          {st?.configured ? (st.state === "erreur" ? "!" : st.state === "hors-ligne" ? "⌁" : "⟳") : "⚙"}
        </button>
      </header>
      {page === "accueil" ? (
        <>
          <ul className="tuiles">
            {APPS.map((a) => (
              <li key={a.id}>
                <a href={`./${a.id}/`} style={{ ["--c" as string]: a.color }}>
                  <span className="icone">{a.icon}</span>
                  <b>{a.name}</b>
                  <small>{a.tagline}</small>
                </a>
              </li>
            ))}
          </ul>
          <p className="etat">{st?.configured ? (st.lastSync ? `Synchronisé ${new Date(st.lastSync).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : "Pas encore synchronisé") : "Synchronisation non configurée : tes données restent sur ce téléphone."}{st?.state === "erreur" ? ` · ${st.message}` : ""}</p>
        </>
      ) : <Synchro onDone={() => setPage("accueil")} />}
    </div>
  );
}

function Synchro({ onDone }: { onDone: () => void }) {
  const cfg = getConfig();
  const [repo, setRepo] = useState(cfg?.repo ?? "Jojoskeys/rayans-donnees");
  const [token, setToken] = useState("");
  const [phrase, setPhrase] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const access = { repo, token: token || cfg?.token || "" };
      await testConfig(access);
      const k = phrase ? await setupKey(access, phrase) : cfg ? { key: cfg.key, created: false } : null;
      if (!k) throw new Error("tape ta phrase secrète");
      setConfig({ ...access, key: k.key });
      setToken(""); setPhrase("");
      for (const a of APPS) for (const f of a.files) await syncApp(f);
      setMsg(`✓ ${k.created ? "Chiffrement créé avec ta phrase secrète. " : "Phrase secrète reconnue. "}Données chiffrées et synchronisées.`);
    } catch (e) { setMsg(`✗ ${String((e as Error).message ?? e)}`); } finally { setBusy(false); }
  };
  return (
    <section className="carte">
      <h2>Synchronisation avec le PC</h2>
      <p>Tes données passent par un <b>dépôt GitHub privé</b>, <b>chiffrées sur ce téléphone</b> avec ta phrase secrète : GitHub ne voit que du contenu illisible.</p>
      <ol>
        <li>Sur github.com : Settings → Developer settings → <b>Fine-grained tokens</b> → Generate new token.</li>
        <li>Repository access : <b>Only select repositories</b> → rayans-donnees. Permissions : <b>Contents : Read and write</b>.</li>
        <li>Colle le jeton ci-dessous et tape ta phrase secrète (la même sur le PC et l'iPhone).</li>
      </ol>
      <label>Dépôt<input value={repo} onChange={(e) => setRepo(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
      <label>Jeton d'accès<input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={cfg ? "déjà enregistré (laisser vide pour le garder)" : "github_pat_…"} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
      <label>Phrase secrète<input type="password" value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder={cfg ? "déjà enregistrée (laisser vide pour la garder)" : "plusieurs mots, 12 caractères au moins"} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
      <p className="avertissement">Note-la quelque part de sûr : <b>sans elle, les données synchronisées ne peuvent pas être relues</b> (personne ne peut la retrouver, pas même moi). Les données déjà sur chaque appareil restent intactes.</p>
      <div className="ligne">
        <button className="bouton" disabled={busy || (!cfg && (!token || !phrase))} onClick={save}>{busy ? "Vérification…" : "Enregistrer et synchroniser"}</button>
        <button className="lien" onClick={onDone}>Retour</button>
      </div>
      {msg && <p className={msg.startsWith("✓") ? "ok" : "ko"}>{msg}</p>}
      {cfg && <button className="lien danger" onClick={() => { if (confirm("Oublier le jeton et la clé sur ce téléphone ? Les données restent sur l'appareil.")) { setConfig(null); location.reload(); } }}>Oublier le jeton et la clé</button>}
    </section>
  );
}

createRoot(document.getElementById("racine")!).render(<StrictMode><Hub /></StrictMode>);
if ("serviceWorker" in navigator) void navigator.serviceWorker.register("./sw.js").catch(() => {});
