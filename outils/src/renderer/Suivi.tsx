// Panneaux des petites listes : échéances, à lire plus tard, entretien, fichiers récents, textes à coller.
import { useEffect, useState, type ReactNode } from "react";
import { formatSize } from "../core/commands.ts";
import {
  choreStatus, daysBetween, daysLeft, formatDay, hostOf, inDays, iso, KEEP_DAYS, nextDate, normalizeUrl, sinceText, sortChores, sortDeadlines,
  type Deadline, type RecentFile, type Recurrence, type SuiviAction,
} from "../core/suivi.ts";
import type { Goto, State } from "./api-types.ts";
import { api, errText, IconCheck, IconClose, IconCopy } from "./shared.tsx";

type Props = { s: State; goto: Goto | null; notify: (t: string) => void };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const act = (a: SuiviAction) => api.suivi(a);

function useGotoMessage(goto: Goto | null, notify: (t: string) => void) {
  useEffect(() => { if (goto?.message) notify(goto.message); }, [goto]);
}

// ----- Échéances et abonnements -------------------------------------------------------------------

const EMPTY = { id: "", name: "", date: "", cancelBy: "", recurrence: "aucune" as Recurrence, amount: "", note: "" };

export function OutilEcheance({ s, goto, notify }: Props) {
  const [f, setF] = useState({ ...EMPTY, name: goto?.tool === "echeance" ? goto.text ?? "" : "" });
  useGotoMessage(goto, notify);
  useEffect(() => { if (goto?.tool === "echeance" && goto.text) setF((x) => ({ ...x, name: goto.text ?? "" })); }, [goto]);
  const today = iso(s.now);
  const list = sortDeadlines(s.suivi.deadlines, today);
  const valid = f.name.trim() && f.date && (!f.cancelBy || f.cancelBy <= f.date);

  const submit = async () => {
    if (!valid) return;
    await act({ type: "deadline-save", deadline: { id: f.id || uid(), name: f.name.trim(), date: f.date, cancelBy: f.cancelBy || null, recurrence: f.recurrence, amount: f.amount.trim(), note: f.note.trim() } });
    notify(f.id ? "Échéance modifiée." : `${f.name.trim()} ajoutée : rappel ${f.cancelBy ? "3 jours avant la date de résiliation et " : ""}3 jours avant l'échéance.`);
    setF({ ...EMPTY });
  };

  return (
    <section className="outil">
      <header className="entete">
        <div><h1>Échéances et abonnements</h1><p className="aide">Une notification 3 jours avant chaque date. Barre de commande : <code>echeance Netflix 15/12</code>.</p></div>
        <button className="bouton secondaire" disabled={!list.length} onClick={async () => {
          try { const p = await api.exportIcs(); if (p) notify(`Agenda exporté : ${p}. Envoyez ce fichier sur le téléphone (commande « tel ») et ouvrez-le.`); }
          catch (e) { notify(errText(e)); }
        }}><IconCalendar /> Exporter pour l'agenda (.ics)</button>
      </header>

      <div className="carte formulaire" data-testid="form-echeance">
        <label>Nom<input data-testid="echeance-nom" value={f.name} maxLength={120} placeholder="Netflix, assurance auto, contrôle technique…" onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label>Date de l'échéance<input data-testid="echeance-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label><span>Résilier avant le <small>(facultatif)</small></span><input type="date" value={f.cancelBy} max={f.date || undefined} onChange={(e) => setF({ ...f, cancelBy: e.target.value })} /></label>
        <label>Répétition
          <select value={f.recurrence} onChange={(e) => setF({ ...f, recurrence: e.target.value as Recurrence })}>
            <option value="aucune">Une seule fois</option><option value="mensuelle">Tous les mois</option><option value="annuelle">Tous les ans</option>
          </select>
        </label>
        <label><span>Montant <small>(facultatif)</small></span><input value={f.amount} maxLength={40} placeholder="13,49 €/mois" onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        <label className="large"><span>Note <small>(facultatif)</small></span><input value={f.note} maxLength={300} placeholder="Résiliation par courrier recommandé…" onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        <div className="actions-form">
          {f.cancelBy && f.date && f.cancelBy > f.date && <span className="erreur">La résiliation doit être avant l'échéance.</span>}
          {f.id && <button className="lien" onClick={() => setF({ ...EMPTY })}>Annuler</button>}
          <button className="bouton" data-testid="echeance-ajouter" disabled={!valid} onClick={submit}>{f.id ? "Enregistrer" : "Ajouter"}</button>
        </div>
      </div>

      {list.length > 0 ? (
        <ul className="liste-suivi" data-testid="echeances">
          {list.map((d) => <EcheanceLigne key={d.id} d={d} today={today} now={s.now} onEdit={() => setF({ ...d, cancelBy: d.cancelBy ?? "" })} />)}
        </ul>
      ) : <p className="aide">Aucune échéance. Abonnements, fins d'essai gratuit, assurances, impôts, papiers à renouveler…</p>}
    </section>
  );
}

function EcheanceLigne({ d, today, now, onEdit }: { d: Deadline; today: string; now: number; onEdit: () => void }) {
  const next = nextDate(d, today);
  const left = daysBetween(today, next);
  const isCancel = next === d.cancelBy;
  return (
    <li className={left < 0 ? "passee" : left <= 3 ? "proche" : ""}>
      <div className="principal">
        <b>{d.name}</b>{d.amount && <span className="discret"> · {d.amount}</span>}
        {d.recurrence !== "aucune" && <span className="badge">{d.recurrence === "mensuelle" ? "mensuel" : "annuel"}</span>}
        <small>
          {d.cancelBy && <>Résilier avant le {formatDay(d.cancelBy, now)} · </>}Échéance le {formatDay(d.date, now)}{d.note && ` · ${d.note}`}
        </small>
      </div>
      <span className="quand">{isCancel ? "résilier " : ""}{inDays(left)}</span>
      <button className="lien" onClick={onEdit}>Modifier</button>
      <button className="icone" title="Supprimer" onClick={() => { if (confirm(`Supprimer « ${d.name} » ?`)) void act({ type: "deadline-delete", id: d.id }); }}><IconClose size={16} /></button>
    </li>
  );
}

// ----- À lire plus tard ---------------------------------------------------------------------------

export function OutilGarde({ s, goto, notify }: Props) {
  const [url, setUrl] = useState("");
  const [reason, setReason] = useState("");
  const [showRead, setShowRead] = useState(false);
  useGotoMessage(goto, notify);
  const unread = [...s.suivi.bookmarks].filter((b) => !b.readAt).sort((a, b) => b.addedAt - a.addedAt);
  const read = [...s.suivi.bookmarks].filter((b) => b.readAt).sort((a, b) => b.readAt! - a.readAt!);
  const add = async () => {
    const u = normalizeUrl(url);
    if (!u) { notify("Lien invalide : collez une adresse comme https://exemple.fr/article"); return; }
    await act({ type: "bookmark-add", id: uid(), url: u, reason: reason.trim() });
    setUrl(""); setReason("");
  };
  const Ligne = ({ b }: { b: (typeof unread)[number] }) => (
    <li className={b.readAt ? "lu" : ""}>
      <div className="principal">
        <button className="lien-titre" title={b.url} onClick={() => api.openUrl(b.url)}>{hostOf(b.url)}<span className="discret">{b.url.replace(/^https?:\/\/(www\.)?[^/]+/, "").slice(0, 70)}</span></button>
        <small>{b.reason ? <><b>{b.reason}</b> · </> : null}ajouté {inDays(-Math.floor((s.now - b.addedAt) / 86_400_000))} · effacé dans {daysLeft(b, s.now)} j</small>
      </div>
      <button className="bouton secondaire petit" onClick={() => act({ type: "bookmark-read", id: b.id, read: !b.readAt })}>{b.readAt ? "Pas lu" : <><IconCheck size={15} /> Lu</>}</button>
      <button className="icone" title="Supprimer" onClick={() => act({ type: "bookmark-delete", id: b.id })}><IconClose size={16} /></button>
    </li>
  );
  return (
    <section className="outil">
      <header><h1>À lire plus tard</h1><p className="aide">Avec la raison, pour s'en souvenir. Chaque lien est effacé {KEEP_DAYS} jours après avoir été gardé. Barre : <code>garde exemple.fr/article pour le mémoire</code>, ou <code>garde</code> avec un lien copié.</p></header>
      <div className="barre">
        <input className="flexible" data-testid="garde-url" value={url} placeholder="Lien" onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void add(); }} />
        <input className="flexible" value={reason} maxLength={300} placeholder="Pourquoi ? (facultatif)" onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void add(); }} />
        <button className="bouton" data-testid="garde-ajouter" disabled={!url.trim()} onClick={add}>Garder</button>
      </div>
      {unread.length ? <ul className="liste-suivi" data-testid="liens">{unread.map((b) => <Ligne key={b.id} b={b} />)}</ul> : <p className="aide">Rien à lire.</p>}
      {read.length > 0 && <button className="lien" onClick={() => setShowRead(!showRead)}>{showRead ? "Masquer" : "Afficher"} les {read.length} lien{read.length > 1 ? "s" : ""} lu{read.length > 1 ? "s" : ""}</button>}
      {showRead && <ul className="liste-suivi">{read.map((b) => <Ligne key={b.id} b={b} />)}</ul>}
    </section>
  );
}

// ----- Entretien ----------------------------------------------------------------------------------

export function OutilFait({ s, goto, notify }: Props) {
  const [name, setName] = useState("");
  const [interval, setInterval_] = useState(30);
  useGotoMessage(goto, notify);
  const list = sortChores(s.suivi.chores, s.now);
  const add = async (done: boolean) => {
    if (!name.trim()) return;
    const id = uid();
    await act({ type: "chore-save", chore: { id, name: name.trim(), intervalDays: interval, done: done ? [s.now] : [] } });
    setName("");
  };
  return (
    <section className="outil">
      <header><h1>Entretien</h1><p className="aide">Ce qu'on fait de temps en temps : depuis combien de temps, en rouge quand c'est trop. Barre : <code>fait vidange</code>.</p></header>
      <div className="barre">
        <input className="flexible" data-testid="fait-nom" value={name} maxLength={120} placeholder="Nouvelle tâche : changer la brosse à dents, détartrer la bouilloire…" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void add(true); }} />
        <label className="champ-ligne">tous les<input type="number" min={1} max={3650} value={interval} onChange={(e) => setInterval_(Math.max(1, Math.min(3650, Number(e.target.value) || 1)))} />jours</label>
        <button className="bouton" disabled={!name.trim()} onClick={() => add(true)}>Fait aujourd'hui</button>
        <button className="lien" disabled={!name.trim()} onClick={() => add(false)}>Ajouter sans date</button>
      </div>
      {list.length ? (
        <ul className="liste-suivi" data-testid="taches">
          {list.map((c) => {
            const st = choreStatus(c, s.now);
            return (
              <li key={c.id} className={st.late ? "en-retard" : st.soon ? "proche" : "ok"}>
                <div className="principal">
                  <b>{c.name}</b>
                  <small title={c.done.map((t) => new Date(t).toLocaleDateString("fr-FR")).reverse().join(", ")}>
                    {st.last ? `le ${new Date(st.last).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}` : "jamais noté"} · tous les
                    <input type="number" className="mini" min={1} max={3650} defaultValue={c.intervalDays} title="Intervalle en jours"
                      onBlur={(e) => { const v = Math.round(Number(e.target.value)); if (v >= 1 && v !== c.intervalDays) void act({ type: "chore-save", chore: { ...c, intervalDays: v } }); }} /> jours
                  </small>
                </div>
                <span className="quand" data-testid="depuis">{sinceText(st.days)}</span>
                <button className="bouton secondaire petit" onClick={() => act({ type: "chore-done", id: c.id, name: c.name })}><IconCheck size={15} /> Fait</button>
                <button className="lien" disabled={!c.done.length} title="Retirer la dernière date" onClick={() => act({ type: "chore-undo", id: c.id })}>Annuler</button>
                <button className="icone" title="Supprimer" onClick={() => { if (confirm(`Supprimer « ${c.name} » ?`)) void act({ type: "chore-delete", id: c.id }); }}><IconClose size={16} /></button>
              </li>
            );
          })}
        </ul>
      ) : <p className="aide">Aucune tâche. Vidange, filtre de la hotte, piles du détecteur de fumée, coiffeur…</p>}
    </section>
  );
}

// ----- Fichiers récents ---------------------------------------------------------------------------

export function OutilRecent({ notify }: Props) {
  const [files, setFiles] = useState<RecentFile[] | null>(null);
  const load = () => { setFiles(null); api.recents().then(setFiles).catch((e) => { notify(errText(e)); setFiles([]); }); };
  useEffect(load, []);
  const when = (t: number) => {
    const d = new Date(t), now = new Date();
    const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    if (iso(t) === iso(now.getTime())) return `aujourd'hui ${time}`;
    if (iso(t + 86_400_000) === iso(now.getTime())) return `hier ${time}`;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + ` ${time}`;
  };
  return (
    <section className="outil">
      <header className="entete">
        <div><h1>Fichiers récents</h1><p className="aide">Les 20 derniers fichiers créés dans Téléchargements, Bureau, Documents et Captures d'écran.</p></div>
        <button className="bouton secondaire" onClick={load}>Actualiser</button>
      </header>
      {files === null ? <p className="aide">Recherche…</p> : files.length ? (
        <ul className="liste-suivi" data-testid="recents">
          {files.map((f) => (
            <li key={f.path}>
              <div className="principal">
                <button className="lien-titre" title={f.path} onClick={() => api.openPath(f.path)}>{f.name}</button>
                <small>{f.folder} · {formatSize(f.size)}</small>
              </div>
              <span className="quand">{when(f.created)}</span>
              <button className="lien" onClick={() => api.openPath(f.path)}>Ouvrir</button>
              <button className="lien" onClick={() => api.showInFolder(f.path)}>Dossier</button>
            </li>
          ))}
        </ul>
      ) : <p className="aide">Aucun fichier.</p>}
    </section>
  );
}

// ----- Textes à coller ----------------------------------------------------------------------------

export function OutilColle({ s, goto, notify }: Props) {
  useGotoMessage(goto, notify);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const add = async () => {
    if (!name.trim() || !text) return;
    if (s.suivi.snippets.some((x) => x.name.toLowerCase() === name.trim().toLowerCase())) { notify(`« ${name.trim()} » existe déjà.`); return; }
    await act({ type: "snippet-save", snippet: { id: uid(), name: name.trim(), text } });
    setName(""); setText("");
  };
  return (
    <section className="outil">
      <header><h1>Textes à coller</h1><p className="aide">IBAN, adresse, numéro de sécurité sociale, réponses types… <code>colle iban</code> dans la barre copie le texte : il n'y a plus qu'à faire Ctrl + V.</p></header>
      <div className="carte pile">
        <div className="barre"><input data-testid="colle-nom" value={name} maxLength={60} placeholder="Nom court (iban, adresse…)" onChange={(e) => setName(e.target.value)} /></div>
        <textarea data-testid="colle-texte" rows={3} value={text} placeholder="Texte" onChange={(e) => setText(e.target.value)} />
        <button className="bouton" data-testid="colle-ajouter" disabled={!name.trim() || !text} onClick={add}>Enregistrer</button>
      </div>
      {s.suivi.snippets.length > 0 && (
        <ul className="liste-suivi textes" data-testid="textes">
          {[...s.suivi.snippets].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((x) => (
            <li key={x.id}>
              <div className="principal">
                <input className="nom-texte" defaultValue={x.name} maxLength={60} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== x.name) void act({ type: "snippet-save", snippet: { ...x, name: v } }); }} />
                <textarea rows={Math.min(6, x.text.split("\n").length)} defaultValue={x.text} onBlur={(e) => { if (e.target.value !== x.text) void act({ type: "snippet-save", snippet: { ...x, text: e.target.value } }); }} />
              </div>
              <button className="bouton secondaire petit" onClick={() => { api.copy(x.text); notify(`« ${x.name} » copié.`); }}><IconCopy size={15} /> Copier</button>
              <button className="icone" title="Supprimer" onClick={() => { if (confirm(`Supprimer « ${x.name} » ?`)) void act({ type: "snippet-delete", id: x.id }); }}><IconClose size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      <p className="aide">Les textes restent sur cet ordinateur, dans le dossier de données de Rayan's Outils (non chiffré). N'y mettez pas de mot de passe.</p>
    </section>
  );
}

// ----- Icônes -------------------------------------------------------------------------------------

const Svg = ({ children, size = 20 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
type P = { size?: number };
export const IconCalendar = (p: P) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>;
export const IconBookmark = (p: P) => <Svg {...p}><path d="M6 3h12v18l-6-4-6 4z" /></Svg>;
export const IconBroom = (p: P) => <Svg {...p}><path d="M14 4l6 6M17 7l-7 7M10 14c-3 0-6 2-7 7 5-1 7-4 7-7z" /></Svg>;
export const IconClock = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const IconClipboard = (p: P) => <Svg {...p}><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4h6v3H9zM9 12h6M9 16h4" /></Svg>;
