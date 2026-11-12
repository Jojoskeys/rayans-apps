import { useEffect, useRef, useState } from "react";
import { addDecks, addRows, importCsv, importJson, parseDb, type ImportRow, type JsonImport } from "../core/io";
import { KIND_LABELS, type CardKind } from "../core/model";
import { pickImportFile, type PickedFile } from "../storage";
import { Modal, plural, useApp } from "../ui";

type Parsed =
  | { kind: "rows"; rows: ImportRow[]; errors: { line: number; message: string }[] }
  | { kind: "decks"; data: JsonImport };

function parseFile(f: PickedFile): Parsed {
  const isJson = /\.json$/i.test(f.name) || /^\s*[[{]/.test(f.text.replace(/^﻿/, ""));
  if (isJson) {
    const data = importJson(f.text);
    if (data.decks.length > 0) return { kind: "decks", data };
    return { kind: "rows", rows: data.rows, errors: data.errors };
  }
  const r = importCsv(f.text);
  return { kind: "rows", rows: r.rows, errors: r.errors };
}

/** Assistant d'import : choix du fichier, aperçu, destination, puis ajout. */
export default function ImportDialog({ deckId, onClose }: { deckId?: string; onClose: () => void }) {
  const { db, update, toast, confirm, go } = useApp();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string>(deckId ?? "__new__");
  const [newName, setNewName] = useState("");
  const [keepProgress, setKeepProgress] = useState(true);
  const [picking, setPicking] = useState(false);

  const choose = async () => {
    setPicking(true);
    setError(null);
    try {
      const f = await pickImportFile();
      if (!f) { if (!file) onClose(); return; }
      setFile(f);
      setNewName(f.name.replace(/\.[^.]+$/, ""));
      setParsed(parseFile(f));
    } catch (e) {
      setParsed(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPicking(false);
    }
  };

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // StrictMode (développement) lance les effets deux fois
    started.current = true;
    void choose();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const importRows = (rows: ImportRow[]) => {
    const fallbackName = newName.trim() || "Import";
    const r = addRows(db, rows, { deckId: target === "__new__" ? undefined : target, fallbackName });
    update(() => r.db);
    toast(`${plural(r.added, "carte importée", "cartes importées")}${r.decksCreated ? `, ${plural(r.decksCreated, "paquet créé", "paquets créés")}` : ""}.`);
    const dest = target !== "__new__" ? target : r.db.decks.find((d) => d.name === fallbackName)?.id;
    onClose();
    if (dest && rows.every((x) => !x.deck)) go({ name: "deck", deckId: dest });
  };

  const importDecks = (data: JsonImport) => {
    const r = addDecks(db, data.decks, keepProgress);
    update(() => r.db);
    toast(`${plural(data.decks.length, "paquet importé", "paquets importés")} (${plural(r.added, "carte", "cartes")}).`);
    onClose();
  };

  const restoreAll = async () => {
    if (!file) return;
    const ok = await confirm({
      title: "Remplacer toutes vos données ?",
      message: <p>Vos paquets, cartes, progression et réglages actuels seront remplacés par ceux de la sauvegarde « {file.name} ». La version actuelle reste dans revision.bak.json.</p>,
      confirmLabel: "Tout remplacer",
      danger: true,
    });
    if (!ok) return;
    try {
      const restored = parseDb(file.text);
      update(() => restored);
      toast("Sauvegarde restaurée.");
      onClose();
      go({ name: "home" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const kinds = (rows: ImportRow[]) => {
    const n: Partial<Record<CardKind, number>> = {};
    rows.forEach((r) => (n[r.kind] = (n[r.kind] ?? 0) + 1));
    return (Object.entries(n) as [CardKind, number][]).map(([k, v]) => `${v} ${KIND_LABELS[k].toLowerCase()}`).join(", ");
  };

  return (
    <Modal title="Importer des cartes" onClose={onClose} wide>
      <div className="modal-body">
        {picking && !file && <p className="muted">Choisissez un fichier CSV, texte ou JSON…</p>}
        {file && <p>Fichier : <b>{file.name}</b> <button className="link" onClick={choose}>changer</button></p>}
        {error && <p className="form-error">{error}</p>}

        {parsed?.kind === "rows" && (
          <>
            <p>
              {parsed.rows.length > 0 ? <><b>{plural(parsed.rows.length, "carte prête", "cartes prêtes")}</b> ({kinds(parsed.rows)})</> : <b>Aucune carte reconnue.</b>}
              {parsed.errors.length > 0 && <> · {plural(parsed.errors.length, "ligne ignorée", "lignes ignorées")}</>}
            </p>
            {parsed.errors.length > 0 && (
              <ul className="errors">
                {parsed.errors.slice(0, 8).map((e) => <li key={e.line}>Ligne {e.line} : {e.message}</li>)}
                {parsed.errors.length > 8 && <li>… et {parsed.errors.length - 8} autres</li>}
              </ul>
            )}
            {parsed.rows.length > 0 && (
              <>
                <table className="cards preview">
                  <tbody>
                    {parsed.rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td><span className={`badge ${r.kind}`}>{KIND_LABELS[r.kind]}</span></td>
                        <td className="clamp">{r.question}</td>
                        <td className="clamp muted">{r.answer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.rows.some((r) => r.deck) && <p className="hint">Les lignes qui indiquent un paquet vont dans ce paquet (créé s'il n'existe pas).</p>}
                <div className="grid-2">
                  <label className="field">
                    <span>Ajouter dans</span>
                    <select value={target} onChange={(e) => setTarget(e.target.value)}>
                      <option value="__new__">Un nouveau paquet</option>
                      {db.decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </label>
                  {target === "__new__" && (
                    <label className="field">
                      <span>Nom du nouveau paquet</span>
                      <input value={newName} onChange={(e) => setNewName(e.target.value)} />
                    </label>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {parsed?.kind === "decks" && (
          <>
            <p>
              {parsed.data.isBackup ? "Sauvegarde complète de Rayan's Révision" : "Paquets exportés de Rayan's Révision"} :{" "}
              {parsed.data.decks.map((d) => `« ${d.deck.name} » (${d.cards.length})`).join(", ")}.
            </p>
            <label className="check">
              <input type="checkbox" checked={keepProgress} onChange={(e) => setKeepProgress(e.target.checked)} />
              Garder la progression des cartes (sinon elles redeviennent nouvelles)
            </label>
            {parsed.data.isBackup && (
              <p className="hint">« Tout remplacer » restaure exactement la sauvegarde (y compris l'historique et les réglages).</p>
            )}
          </>
        )}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Annuler</button>
        {parsed?.kind === "decks" && parsed.data.isBackup && <button className="btn danger" onClick={restoreAll}>Tout remplacer</button>}
        {parsed?.kind === "decks" && <button className="btn primary" onClick={() => importDecks(parsed.data)}>Ajouter {parsed.data.decks.length > 1 ? "les paquets" : "le paquet"}</button>}
        {parsed?.kind === "rows" && (
          <button className="btn primary" disabled={parsed.rows.length === 0} onClick={() => importRows(parsed.rows)}>
            Importer {plural(parsed.rows.length, "carte", "cartes")}
          </button>
        )}
      </div>
    </Modal>
  );
}
