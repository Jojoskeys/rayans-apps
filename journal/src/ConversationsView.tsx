import { useCallback, useEffect, useState } from "react";
import { api, texteErreur, type ConversationVue, type Filtre, type MessageVue, type RapportImport } from "./api";
import { Confirm } from "./Confirm";
import { APPLIS, complet, debutJour, local, pluriel } from "./format";

const STATUTS: Record<string, string> = {
  originale: "version archivée",
  modifiee: "nouvelle version (modifiée)",
  modifiee_avant_archivage: "déjà modifiée avant le premier archivage",
  mention_suppression: "mention de suppression dans l’export",
};

export function ConversationsView(p: { onChange: () => void }) {
  const [appli, setAppli] = useState<string>("");
  const [convs, setConvs] = useState<ConversationVue[]>([]);
  const [choix, setChoix] = useState<number | null>(null);
  const [mots, setMots] = useState("");
  const [etat, setEtat] = useState("");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [msgs, setMsgs] = useState<MessageVue[]>([]);
  const [rapport, setRapport] = useState<RapportImport | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<ConversationVue | null>(null);

  const chargerConvs = useCallback(async () => {
    try {
      setConvs(await api.conversations(appli || null));
    } catch (e) {
      setErreur(texteErreur(e));
    }
  }, [appli]);

  useEffect(() => {
    chargerConvs();
  }, [chargerConvs]);

  const filtre = useCallback((): Filtre => {
    const d = debutJour(du);
    const a = debutJour(au);
    return {
      appli: appli || null,
      conversation: choix,
      mots,
      categorie: etat || null,
      duMs: d,
      auMs: a !== null ? a + 86_400_000 : null,
      limite: 1000,
    };
  }, [appli, choix, mots, etat, du, au]);

  useEffect(() => {
    if (choix === null && !mots.trim() && !etat && !du && !au) {
      setMsgs([]);
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        setMsgs(await api.messages(filtre()));
        setErreur(null);
      } catch (e) {
        setErreur(texteErreur(e));
      }
    }, 200);
    return () => window.clearTimeout(t);
  }, [filtre, choix, mots, etat, du, au]);

  const importer = async (dossier: boolean) => {
    const chemin = await api.choisirExport(dossier);
    if (!chemin) return;
    setErreur(null);
    setRapport(null);
    setOccupe("Lecture et archivage de l’export…");
    try {
      const r = await api.importer(chemin);
      setRapport(r);
      await chargerConvs();
      p.onChange();
      if (choix !== null) setMsgs(await api.messages(filtre()));
    } catch (e) {
      setErreur(texteErreur(e));
    } finally {
      setOccupe(null);
    }
  };

  const exporter = async () => {
    try {
      const f = await api.exporter("messages", filtre());
      if (f) setRapport(null);
    } catch (e) {
      setErreur(texteErreur(e));
    }
  };

  const conv = convs.find((c) => c.id === choix);
  return (
    <section className="page" style={{ maxWidth: 1200 }}>
      <header className="page-head">
        <div>
          <h1>Conversations</h1>
          <p className="muted">
            Archive de tes exports officiels, texte mot pour mot. Un nouvel import n’efface jamais rien : un message modifié garde toutes ses versions, un
            message supprimé depuis reste lisible tel qu’il a été archivé.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => importer(true)} disabled={!!occupe}>Importer un dossier…</button>
          <button className="btn primary" onClick={() => importer(false)} disabled={!!occupe}>Importer un fichier…</button>
        </div>
      </header>
      {occupe && <div className="alert">{occupe}</div>}
      {erreur && <div className="alert bad">{erreur}</div>}
      {rapport && <Rapport r={rapport} onFermer={() => setRapport(null)} />}

      <div className="row wrap">
        {["", ...Object.keys(APPLIS)].map((a) => (
          <button key={a || "tout"} className={"btn small" + (appli === a ? " primary" : " ghost")} onClick={() => { setAppli(a); setChoix(null); }}>
            {a ? APPLIS[a] : "Toutes"}
          </button>
        ))}
      </div>

      {convs.length === 0 && !occupe ? (
        <Guide />
      ) : (
        <div className="conv-layout">
          <div className="conv-list">
            <button className={"conv" + (choix === null ? " active" : "")} onClick={() => setChoix(null)}>
              <span className="conv-name">Rechercher partout</span>
              <span className="small muted">{pluriel(convs.length, "conversation")}</span>
            </button>
            {convs.map((c) => (
              <button key={c.id} className={"conv" + (choix === c.id ? " active" : "")} onClick={() => setChoix(c.id)}>
                <span className="conv-name">{c.nom}</span>
                <span className="small muted">
                  {APPLIS[c.appli] ?? c.appli} · {pluriel(c.messages, "message")}
                  {c.supprimes > 0 && ` · ${c.supprimes} supprimé${c.supprimes > 1 ? "s" : ""} depuis`}
                </span>
              </button>
            ))}
          </div>
          <div className="msgs">
            <div className="filters">
              <label className="field large">
                <span className="field-label">Mots-clés {conv ? `dans « ${conv.nom} »` : "dans toutes les conversations"}</span>
                <input placeholder="sans accents ni majuscules, début de mot" value={mots} onChange={(e) => setMots(e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">Envoyé du</span>
                <input type="date" value={du} onChange={(e) => setDu(e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">au (inclus)</span>
                <input type="date" value={au} onChange={(e) => setAu(e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">Messages</span>
                <select value={etat} onChange={(e) => setEtat(e.target.value)}>
                  <option value="">Tous</option>
                  <option value="modifie">Modifiés</option>
                  <option value="supprime">Supprimés ou absents depuis</option>
                  <option value="suppression_signalee">Suppression signalée par l’appli</option>
                  <option value="absent_constate">Absents du dernier export</option>
                </select>
              </label>
            </div>
            {conv && (
              <div className="row">
                <span className="muted small">
                  {pluriel(conv.messages, "message")} envoyés du {conv.premierMs ? local(conv.premierMs) : "?"} au {conv.dernierMs ? local(conv.dernierMs) : "?"}
                </span>
                <div className="row" style={{ marginLeft: "auto" }}>
                  <button className="btn small" onClick={exporter}>Exporter</button>
                  <button className="btn small danger" onClick={() => setASupprimer(conv)}>Retirer de l’archive…</button>
                </div>
              </div>
            )}
            {msgs.length === 0 ? (
              <div className="empty small-empty">
                <p className="muted">{choix === null && !mots ? "Choisis une conversation, ou tape des mots-clés." : "Aucun message pour ces critères."}</p>
              </div>
            ) : (
              msgs.map((m) => <Message key={m.id} m={m} avecConv={choix === null} />)
            )}
            {msgs.length >= 1000 && <p className="muted small">1 000 premiers résultats affichés : précise la recherche.</p>}
          </div>
        </div>
      )}
      {aSupprimer && (
        <Confirm
          title="Retirer cette conversation de l’archive ?"
          confirmLabel="Retirer définitivement"
          onCancel={() => setASupprimer(null)}
          onConfirm={async () => {
            await api.supprimerConversation(aSupprimer.id);
            setASupprimer(null);
            setChoix(null);
            await chargerConvs();
            p.onChange();
          }}
        >
          <p>
            « {aSupprimer.nom} » ({pluriel(aSupprimer.messages, "message")}, toutes versions et pièces jointes) sera effacée de l’archive. Cela ne touche pas
            l’application d’origine. Impossible à annuler, sauf en réimportant un export qui contient encore ces messages.
          </p>
        </Confirm>
      )}
    </section>
  );
}

function Message({ m, avecConv }: { m: MessageVue; avecConv: boolean }) {
  const [toutes, setToutes] = useState(false);
  const versions = m.versions;
  const derniere = versions[versions.length - 1];
  const lisibles = versions.filter((v) => v.statut !== "mention_suppression");
  const supprime = m.etat !== "present";
  // Pour un message supprimé : on montre le dernier texte archivé avant la suppression.
  const principale = supprime && lisibles.length ? lisibles[lisibles.length - 1] : derniere;
  const autres = versions.filter((v) => v !== principale);
  const modifie = versions.some((v) => v.statut === "modifiee" || v.statut === "modifiee_avant_archivage");
  return (
    <article className={"msg" + (m.etat === "suppression_signalee" ? " supprime" : m.etat === "absent_constate" ? " absent" : "")}>
      <div className="msg-head">
        <span className="msg-author">{m.auteur ?? "(message du système)"}</span>
        <span className="small muted" title={`${m.envoi.fuseau} · précision : ${m.envoi.precision}`}>
          envoyé {complet(m.envoi)} · {m.envoi.precision}
        </span>
        {avecConv && <span className="tag">{APPLIS[m.appli] ?? m.appli} · {m.conversationNom}</span>}
        {modifie && <span className="tag warn">modifié</span>}
        {m.etat === "suppression_signalee" && <span className="tag bad">suppression signalée</span>}
        {m.etat === "absent_constate" && <span className="tag warn">absent du dernier export</span>}
      </div>
      {principale.statut === "mention_suppression" ? (
        <p className="muted"><em>{principale.texte}</em> — texte d’origine non disponible (supprimé avant le premier archivage).</p>
      ) : (
        principale.texte && <pre className="verbatim">{principale.texte}</pre>
      )}
      {m.pieces.map((pc) => (
        <div key={pc.id} className="row small">
          <span>📎 {pc.nom}</span>
          {pc.disponible ? (
            <button className="link" onClick={() => api.enregistrerPiece(pc.id)}>Enregistrer une copie…</button>
          ) : (
            <span className="muted">{pc.note ?? "non archivée"}</span>
          )}
        </div>
      ))}
      {m.details.length > 0 && <div className="small muted">{m.details.join(" · ")}</div>}
      {m.etatNote && <div className="small" style={{ color: m.etat === "present" ? "var(--muted)" : "var(--warn)" }}>{m.etatNote}</div>}
      {autres.length > 0 && (
        <button className="link small" onClick={() => setToutes(!toutes)}>
          {toutes ? "Masquer" : "Voir"} {pluriel(versions.length, "version")} et leurs horodatages
        </button>
      )}
      {toutes &&
        versions.map((v, i) => (
          <div key={i} className={"version" + (v === principale ? "" : " old")}>
            <span className="small muted">
              {i + 1}. {STATUTS[v.statut] ?? v.statut} · archivée le {local(v.archiveMs)}
              {v.modifie && ` · modifiée le ${complet(v.modifie)}`}
            </span>
            <pre className="verbatim">{v.texte}</pre>
          </div>
        ))}
      <span className="small muted">Archivé le {local(m.archiveMs)}</span>
    </article>
  );
}

function Rapport({ r, onFermer }: { r: RapportImport; onFermer: () => void }) {
  return (
    <div className="card" style={{ borderColor: "rgba(79, 214, 160, 0.4)" }}>
      <div className="row">
        <h2>Import {APPLIS[r.appli] ?? r.appli} terminé</h2>
        <button className="link" style={{ marginLeft: "auto" }} onClick={onFermer}>Fermer</button>
      </div>
      <div className="report-grid">
        <Stat v={r.nouveaux} l="nouveaux messages" />
        <Stat v={r.nouvellesVersions} l="nouvelles versions (modifiés)" />
        <Stat v={r.inchanges} l="déjà archivés, inchangés" />
        <Stat v={r.suppressionsSignalees} l="suppressions signalées" />
        <Stat v={r.absencesConstatees} l="absents de cet export (gardés)" />
        <Stat v={r.piecesArchivees} l={`pièces jointes archivées${r.piecesManquantes ? ` · ${r.piecesManquantes} non incluses` : ""}`} />
      </div>
      <p className="small muted">{pluriel(r.messagesLus, "message lu", "messages lus")} dans {pluriel(r.conversations, "conversation")}.</p>
      {r.avertissements.map((a, i) => (
        <p key={i} className="small muted">• {a}</p>
      ))}
    </div>
  );
}

function Stat({ v, l }: { v: number; l: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{v.toLocaleString("fr-FR")}</div>
      <div className="small muted">{l}</div>
    </div>
  );
}

function Guide() {
  return (
    <div className="how">
      <div className="card">
        <h2>WhatsApp</h2>
        <ol>
          <li>Sur l’iPhone : ouvre la discussion → nom du contact → Exporter la discussion.</li>
          <li>« Joindre les médias » pour garder les pièces jointes.</li>
          <li>Envoie le .zip sur le PC (AirDrop, OneDrive…) puis « Importer un fichier ».</li>
        </ol>
        <p className="small muted">Heure à la seconde, sans fuseau (déduit). Une discussion à la fois. Réexporte régulièrement pour garder les messages avant suppression.</p>
      </div>
      <div className="card">
        <h2>Telegram</h2>
        <ol>
          <li>Telegram Desktop → Paramètres → Avancé → Exporter les données Telegram.</li>
          <li>Format : « JSON lisible par une machine ».</li>
          <li>Importe le dossier produit (celui qui contient result.json).</li>
        </ol>
        <p className="small muted">Identifiants stables, heure UTC à la seconde, heure de modification. Les messages supprimés n’y sont plus.</p>
      </div>
      <div className="card">
        <h2>Discord</h2>
        <ol>
          <li>Paramètres → Données et confidentialité → Demander toutes mes données.</li>
          <li>Discord envoie un lien par e-mail (jusqu’à 30 jours).</li>
          <li>Importe le fichier package.zip.</li>
        </ol>
        <p className="small muted">Seulement tes propres messages. Les pièces jointes sont des liens qui expirent.</p>
      </div>
      <div className="card">
        <h2>Instagram et Messenger</h2>
        <ol>
          <li>Centre de comptes → Vos informations et autorisations → Télécharger vos informations.</li>
          <li>Choisis Messages, format JSON, qualité des médias élevée.</li>
          <li>Importe le .zip reçu (ou chaque partie s’il y en a plusieurs).</li>
        </ol>
        <p className="small muted">Heure à la milliseconde. Messages retirés absents. Discussions Messenger chiffrées : « Stockage sécurisé des messages », pas encore lisible ici.</p>
      </div>
    </div>
  );
}
