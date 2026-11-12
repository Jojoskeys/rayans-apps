import { useMemo, useState } from "react";
import { clozeFull } from "../core/answer";
import { exportCsv, exportJson, searchText, simplifyForSearch } from "../core/io";
import { KIND_LABELS, cleanDraft, makeCard, type Card, type CardKind, type Deck } from "../core/model";
import { dueCounts, resetCard } from "../core/session";
import { breakdown } from "../core/stats";
import { safeFileName, saveExportFile } from "../storage";
import { cardStatus, fmtPercent, plural, useApp } from "../ui";
import CardEditor from "./CardEditor";

export default function DeckView({ deckId }: { deckId: string }) {
  const { db, update, go, toast, confirm, startImport } = useApp();
  const deck = db.decks.find((d) => d.id === deckId);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<CardKind | "">("");
  const [editing, setEditing] = useState<Card | "new" | null>(null);
  const [renaming, setRenaming] = useState(false);
  const now = Date.now();

  const cards = useMemo(() => db.cards.filter((c) => c.deckId === deckId), [db.cards, deckId]);
  const shown = useMemo(() => {
    const q = simplifyForSearch(query);
    return cards.filter((c) => (!kindFilter || c.kind === kindFilter) && (!q || searchText(c).includes(q)));
  }, [cards, query, kindFilter]);

  if (!deck) {
    return (
      <div className="page">
        <p>Ce paquet n'existe plus.</p>
        <button className="btn" onClick={() => go({ name: "home" })}>Retour</button>
      </div>
    );
  }

  const counts = dueCounts(db, now, deckId);
  const bd = breakdown(db, now, deckId);
  const setDeck = (patch: Partial<Deck>) => update((d) => ({ ...d, decks: d.decks.map((x) => (x.id === deckId ? { ...x, ...patch } : x)) }));
  const setCard = (id: string, fn: (c: Card) => Card) => update((d) => ({ ...d, cards: d.cards.map((c) => (c.id === id ? fn(c) : c)) }));

  const removeDeck = async () => {
    const ok = await confirm({
      title: "Supprimer le paquet ?",
      message: <p>« {deck.name} » et ses {plural(cards.length, "carte", "cartes")} seront supprimés, avec leur progression. Pensez à l'exporter avant si vous voulez le garder.</p>,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    update((d) => ({ ...d, decks: d.decks.filter((x) => x.id !== deckId), cards: d.cards.filter((c) => c.deckId !== deckId) }));
    toast(`Paquet « ${deck.name} » supprimé.`);
    go({ name: "home" });
  };

  const removeCard = async (c: Card) => {
    const ok = await confirm({ title: "Supprimer la carte ?", message: <p className="clamp">{c.kind === "cloze" ? clozeFull(c.question) : c.question}</p>, confirmLabel: "Supprimer", danger: true });
    if (ok) update((d) => ({ ...d, cards: d.cards.filter((x) => x.id !== c.id) }));
  };

  const doExport = async (format: "csv" | "json") => {
    try {
      const text = format === "csv" ? exportCsv(db, [deckId]) : exportJson(db, [deckId]);
      const path = await saveExportFile(`${safeFileName(deck.name)}.${format}`, text);
      if (path) toast(`Exporté : ${path}`);
    } catch (e) {
      toast(`Export impossible : ${String(e)}`, "error");
    }
  };

  return (
    <div className="page">
      <button className="link back" onClick={() => go({ name: "home" })}>← Paquets</button>
      <header className="page-head">
        <div className="grow">
          {renaming ? (
            <form className="inline-form" onSubmit={(e) => { e.preventDefault(); setRenaming(false); }}>
              <input autoFocus value={deck.name} onChange={(e) => setDeck({ name: e.target.value })} onBlur={() => { if (!deck.name.trim()) setDeck({ name: "Sans titre" }); setRenaming(false); }} />
            </form>
          ) : (
            <h1 className="editable" title="Renommer" onClick={() => setRenaming(true)}>{deck.name}</h1>
          )}
          <p className="muted">
            {plural(bd.total, "carte", "cartes")} · {bd.new} nouvelles · {bd.learning} en apprentissage · {bd.review} en révision
            {bd.suspended > 0 && ` · ${bd.suspended} suspendues`} · probabilité moyenne de s'en souvenir : {fmtPercent(bd.avgRecall)}
          </p>
        </div>
        <button className="btn primary big" disabled={counts.total === 0} onClick={() => go({ name: "review", deckId })}>
          Réviser ({counts.total})
        </button>
      </header>

      <section className="deck-settings">
        <label>
          Mode de réponse
          <select value={deck.answerMode} onChange={(e) => setDeck({ answerMode: e.target.value as Deck["answerMode"] })}>
            <option value="typed">Réponse tapée (l'app corrige)</option>
            <option value="flip">Carte retournée (je me note)</option>
          </select>
        </label>
        <label>
          Nouvelles cartes par jour
          <input type="number" min={0} max={9999} value={deck.newPerDay} onChange={(e) => setDeck({ newPerDay: Math.max(0, Math.min(9999, Math.floor(Number(e.target.value) || 0))) })} />
        </label>
        <label className="grow">
          Description
          <input value={deck.description} onChange={(e) => setDeck({ description: e.target.value })} placeholder="Facultatif" />
        </label>
      </section>

      <section>
        <div className="section-head">
          <h2>Cartes</h2>
          <div className="row wrap">
            <button className="btn primary" onClick={() => setEditing("new")}>Ajouter une carte</button>
            <button className="btn" onClick={() => startImport(deckId)}>Importer…</button>
            <button className="btn" onClick={() => doExport("csv")}>Exporter CSV</button>
            <button className="btn" onClick={() => doExport("json")}>Exporter JSON</button>
            <button className="btn danger-ghost" onClick={removeDeck}>Supprimer le paquet</button>
          </div>
        </div>
        <div className="row filters">
          <input className="grow" type="search" placeholder="Rechercher dans les cartes…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as CardKind | "")}>
            <option value="">Tous les types</option>
            {(Object.keys(KIND_LABELS) as CardKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
        </div>
        {shown.length === 0 ? (
          <div className="empty">{cards.length === 0 ? "Ce paquet est vide : ajoutez une carte ou importez un fichier CSV." : "Aucune carte ne correspond."}</div>
        ) : (
          <table className="cards">
            <thead>
              <tr><th>Type</th><th>Question</th><th>Réponse</th><th>État</th><th /></tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className={c.suspended ? "suspended" : ""}>
                  <td><span className={`badge ${c.kind}`}>{KIND_LABELS[c.kind]}</span></td>
                  <td className="clamp" onDoubleClick={() => setEditing(c)}>{c.kind === "cloze" ? clozeFull(c.question) : c.question}</td>
                  <td className="clamp muted">{c.kind === "cloze" ? "—" : c.answer.split("|").join(" / ")}</td>
                  <td className="nowrap small">{cardStatus(c, now)}</td>
                  <td className="nowrap actions">
                    <button className="link" onClick={() => setEditing(c)}>Modifier</button>
                    <button className="link" onClick={() => setCard(c.id, (x) => ({ ...x, suspended: !x.suspended }))}>{c.suspended ? "Réactiver" : "Suspendre"}</button>
                    {c.sched.state !== "new" && <button className="link" onClick={() => setCard(c.id, (x) => resetCard(x, Date.now()))}>Oublier</button>}
                    <button className="link danger" onClick={() => removeCard(c)}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {editing && (
        <CardEditor
          initial={editing === "new" ? undefined : editing}
          defaultKind={kindFilter || "basic"}
          onClose={() => setEditing(null)}
          onSave={(draft, keepOpen) => {
            if (editing === "new") {
              update((d) => ({ ...d, cards: [...d.cards, makeCard(deckId, draft)] }));
              toast("Carte ajoutée.");
            } else {
              const c = cleanDraft(draft);
              setCard(editing.id, (x) => ({ ...x, ...c, updated: Date.now() }));
            }
            if (!keepOpen) setEditing(null);
          }}
        />
      )}
    </div>
  );
}
