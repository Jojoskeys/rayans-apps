// Fac : cours du jour (ADE), propositions tirées des mails partagés, échéances, et réglages.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DisplayCourse, SharedMail } from "../core/fac.ts";
import type { Proposal } from "../core/mail.ts";
import type { FacView } from "./api-types.ts";

const api = window.aujourdhui;
const errText = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
const hm = (t: number) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayName = (t: number) => new Date(t).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const shortDate = (t: number) => new Date(t).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const midnight = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const DAY = 86_400_000;

const KIND_LABEL: Record<Proposal["kind"], string> = { salle: "Changement de salle", annulation: "Cours annulé", horaire: "Changement d'horaire", examen: "Examen", devoir: "À rendre" };

type Run = (p: Promise<FacView>, ok?: string) => void;

/** Vue Aujourd'hui : cours, propositions à valider, échéances. */
export function FacToday({ f, now, notify, onSettings }: { f: FacView; now: number; notify: (t: string) => void; onSettings: () => void }) {
  const [source, setSource] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const run: Run = (p, ok) => { p.then(() => ok && notify(ok)).catch((e) => notify(errText(e))); };

  if (!f.configured && !f.mails.length) {
    return (
      <section className="carte fac-vide" data-testid="fac-a-configurer">
        <h2>Cours de la fac</h2>
        <p className="aide">Relie ton emploi du temps ADE (Université de Rennes) pour voir tes cours, les salles et les changements ici. Aucun mot de passe n'est demandé : seulement l'adresse d'abonnement donnée par ADE.</p>
        <button className="bouton" onClick={onSettings}>Relier ADE</button>
      </section>
    );
  }

  const today = midnight(now);
  const todays = f.courses.filter((c) => midnight(c.start) === today && c.end > today);
  const nextDay = todays.some((c) => c.end > now) ? null : f.courses.find((c) => c.start > now && midnight(c.start) > today);
  const shown = nextDay ? f.courses.filter((c) => midnight(c.start) === midnight(nextDay.start)) : todays;
  const shownDay = nextDay ? midnight(nextDay.start) : today;
  const removed = f.removed.filter((c) => midnight(c.start) === shownDay);
  const pending = f.mails.flatMap((m) => m.proposals.filter((p) => p.status === "a-valider").map((p) => ({ m, p })));
  const deadlines = f.deadlines.filter((d) => d.at > now - DAY && d.at < now + 14 * DAY);
  const mailById = new Map(f.mails.map((m) => [m.id, m]));
  const sourceMail = source ? mailById.get(source) : undefined;

  return (
    <>
      <section className="carte fac" data-testid="fac-cours">
        <div className="titre-ligne">
          <h2>{nextDay ? `Prochains cours : ${dayName(shownDay)}` : todays.length ? "Cours d'aujourd'hui" : "Pas de cours aujourd'hui"}</h2>
          <span className="statut" data-testid="fac-statut">
            {f.fetching ? "Actualisation…" : f.lastError ? <span className="erreur" title={f.lastError}>ADE : {f.lastError}</span> : f.lastFetch ? `ADE actualisé à ${hm(f.lastFetch)}` : ""}
          </span>
          <button className="icone petit" title="Actualiser l'emploi du temps" disabled={f.fetching || !f.configured} onClick={() => run(api.fac.refresh())}><IconRefresh size={16} /></button>
        </div>
        {nextDay && todays.length > 0 && <p className="aide">Les cours d'aujourd'hui sont terminés.</p>}
        {!shown.length && !removed.length && <p className="aide">{f.configured ? "Rien dans ADE pour les 7 prochains jours." : "Emploi du temps ADE non relié."}</p>}
        <ul className="cours">
          {shown.map((c) => <CourseRow key={c.uid} c={c} now={now} run={run} onSource={setSource} />)}
          {removed.map((c) => (
            <li key={`x${c.uid}`} className="cours-ligne annule" data-testid="cours-retire">
              <span className="heure">{hm(c.start)}</span>
              <div><b>{c.title}</b><p className="badge rouge">Retiré d'ADE</p></div>
            </li>
          ))}
        </ul>
      </section>

      {pending.length > 0 && (
        <section className="carte" data-testid="fac-a-valider">
          <h2>À valider <span className="compteur">{pending.length}</span></h2>
          <p className="aide">Tirées des mails que tu as partagés. Rien n'est modifié tant que tu n'as pas validé.</p>
          <ul className="propositions">
            {pending.map(({ m, p }) => <ProposalCard key={p.id} m={m} p={p} run={run} onSource={() => setSource(m.id)} />)}
          </ul>
        </section>
      )}

      {deadlines.length > 0 && (
        <section className="carte" data-testid="fac-echeances">
          <h2>Échéances des 14 prochains jours</h2>
          <ul className="echeances">
            {deadlines.map((d) => (
              <li key={d.id}>
                <span className={`badge ${d.kind === "examen" ? "orange" : "bleu"}`}>{d.kind === "examen" ? "Examen" : "À rendre"}</span>
                <span className="echeance-titre">{d.title}</span>
                <span className="quand">{midnight(d.at) === today ? `aujourd'hui ${hm(d.at)}` : shortDate(d.at)}</span>
                <button className="lien" onClick={() => setSource(d.mailId)}>Source</button>
                <button className="lien danger" onClick={() => run(api.fac.removeDeadline(d.id), "Échéance retirée.")}>Retirer</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="ligne-actions">
        <button className={adding ? "bouton secondaire" : "bouton"} data-testid="bouton-ajouter-mail" onClick={() => setAdding(!adding)}><IconMail size={16} /> Partager un mail de la fac</button>
      </div>
      {adding && <AddMail f={f} notify={notify} onDone={() => setAdding(false)} onSource={setSource} />}
      {sourceMail && <MailSource m={sourceMail} f={f} onClose={() => setSource(null)} run={run} />}
    </>
  );
}

function CourseRow({ c, now, run, onSource }: { c: DisplayCourse; now: number; run: Run; onSource: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const past = c.end < now;
  const current = c.start <= now && c.end > now;
  return (
    <li className={`cours-ligne ${past ? "passe" : ""} ${current ? "en-cours" : ""} ${c.cancelled ? "annule" : ""}`} data-testid="cours" data-uid={c.uid}>
      <span className="heure">{hm(c.start)}<small>{hm(c.end)}</small></span>
      <div className="cours-texte">
        <button className="cours-titre" onClick={() => setOpen(!open)} title="Détails">{c.title}</button>
        <p className="salle" data-testid="salle">{c.cancelled ? "Annulé" : c.room || "Salle non indiquée"}</p>
        <div className="badges">
          {c.changes.map((ch) => (
            <span key={ch.kind} className="badge orange" data-testid="changement" title={`Repéré à ${hm(ch.detectedAt)} en comparant avec le téléchargement précédent`}>
              {ch.kind === "salle" ? `Salle changée : ${ch.before} → ${ch.after}` : ch.kind === "horaire" ? `Horaire changé (avant : ${ch.before})` : "Nouveau cours"}
            </span>
          ))}
          {c.corrected && !c.conflict && (
            <span className="badge bleu" data-testid="correction">
              {c.corrected === "salle" ? "Salle corrigée" : c.corrected === "horaire" ? "Horaire corrigé" : "Annulé"} d'après un mail
              {c.ade?.room !== undefined ? ` · ADE : ${c.ade.room || "sans salle"}` : c.ade?.slot ? ` · ADE : ${c.ade.slot}` : ""}
            </span>
          )}
          {c.conflict && <span className="badge rouge" data-testid="conflit">ADE indique maintenant : {c.conflict}</span>}
        </div>
        {(c.corrected || c.conflict) && (
          <div className="ligne petits-liens">
            {c.mailId && <button className="lien" onClick={() => onSource(c.mailId!)}>Voir le mail</button>}
            {c.conflict ? (
              <>
                <button className="lien" onClick={() => run(api.fac.resolveConflict(c.uid, "ade"), "Valeur d'ADE gardée.")}>Garder ADE</button>
                <button className="lien" onClick={() => run(api.fac.resolveConflict(c.uid, "mail"), "Correction du mail gardée.")}>Garder le mail</button>
              </>
            ) : <button className="lien danger" onClick={() => run(api.fac.undoCorrection(c.uid), "Correction annulée : valeurs d'ADE.")}>Annuler la correction</button>}
          </div>
        )}
        {open && c.details && <p className="details">{c.details}</p>}
      </div>
    </li>
  );
}

function ProposalCard({ m, p, run, onSource }: { m: SharedMail; p: Proposal; run: Run; onSource: () => void }) {
  return (
    <li className="proposition" data-testid="proposition" data-kind={p.kind}>
      <div className="proposition-tete">
        <span className={`badge ${p.kind === "annulation" ? "rouge" : p.kind === "examen" ? "orange" : "bleu"}`}>{KIND_LABEL[p.kind]}</span>
        {p.courseTitle && p.kind !== "examen" && p.kind !== "devoir" && <span className="aide">{p.courseTitle} · {p.courseStart ? shortDate(p.courseStart) : ""}</span>}
      </div>
      {p.before !== undefined && p.kind !== "examen" && p.kind !== "devoir" ? (
        <p className="avant-apres"><span>ADE : <s>{p.before}</s></span><IconArrow size={16} /><b>Mail : {p.after}</b></p>
      ) : <p className="avant-apres"><b>{p.deadlineTitle ?? p.summary}</b> · {p.after}</p>}
      <p className="provenance">
        {m.from || "Expéditeur inconnu"} · « {m.subject || "sans objet"} »{m.date ? ` · ${shortDate(m.date)}` : ""}
        {m.unknownSender && <span className="badge orange" title="Cet expéditeur n'est pas dans ta liste (Réglages → Fac)">Expéditeur hors de ta liste</span>}
      </p>
      <div className="ligne">
        <button className="bouton" data-testid="appliquer" onClick={() => run(api.fac.accept(m.id, p.id), p.kind === "examen" || p.kind === "devoir" ? "Échéance ajoutée." : "Modification appliquée au cours.")}>
          {p.kind === "examen" || p.kind === "devoir" ? "Ajouter l'échéance" : "Appliquer à ce cours"}
        </button>
        <button className="bouton secondaire" onClick={() => run(api.fac.ignore(m.id, p.id))}>Ignorer</button>
        <button className="lien" onClick={onSource}>Voir la source</button>
      </div>
    </li>
  );
}

function AddMail({ f, notify, onDone, onSource }: { f: FacView; notify: (t: string) => void; onDone: () => void; onSource: (id: string) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SharedMail | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const analyse = async (input: string) => {
    if (!input.trim()) return;
    setBusy(true);
    try {
      const before = new Set(f.mails.map((m) => m.id));
      const next = await api.fac.addMail(input);
      const added = next.mails.find((m) => !before.has(m.id)) ?? null;
      setResult(added);
      setText("");
    } catch (e) { notify(errText(e)); } finally { setBusy(false); }
  };
  const readFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000) { notify("Fichier trop gros (2 Mo au plus)."); return; }
    file.text().then(analyse).catch((e) => notify(errText(e)));
  };

  return (
    <section className={`carte ajout-mail ${drag ? "survol" : ""}`} data-testid="ajout-mail"
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files[0]); }}>
      <h2>Partager un mail</h2>
      <p className="aide">Dans le webmail, ouvre le mail puis colle son texte ici (avec les lignes « De », « Objet » et « Date » si tu peux), ou dépose le fichier <code>.eml</code> enregistré depuis le webmail. L'analyse se fait sur ce PC ; seuls l'expéditeur, l'objet, la date et un court extrait sont gardés, 30 jours.</p>
      <textarea data-testid="texte-mail" value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder={"De : Secrétariat <secretariat@univ-rennes.fr>\nObjet : Changement de salle\nDate : 17/11/2026 08:00\n\nBonjour, le TD d'analyse de mardi aura lieu en salle 004…"} />
      <div className="ligne">
        <button className="bouton" data-testid="analyser" disabled={busy || !text.trim()} onClick={() => analyse(text)}>{busy ? "Analyse…" : "Analyser"}</button>
        <button className="bouton secondaire" onClick={() => fileRef.current?.click()}>Choisir un fichier .eml</button>
        <input ref={fileRef} type="file" accept=".eml,.txt,message/rfc822" hidden onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ""; }} />
        <button className="lien" onClick={onDone}>Fermer</button>
      </div>
      {result && (
        <div className="resultat" data-testid="resultat-mail">
          {result.proposals.length === 0 ? <p>Rien trouvé qui touche tes cours ou tes échéances dans « {result.subject || "ce mail"} ». Il est gardé 30 jours au cas où.</p> : (
            <ul>
              {result.proposals.map((p) => (
                <li key={p.id}>{p.status === "deja-a-jour" ? <><IconCheck size={14} /> Déjà à jour dans ADE : {p.summary}</> : <>À valider plus haut : {p.summary}</>}</li>
              ))}
            </ul>
          )}
          {result.unknownSender && <p className="avertissement">L'expéditeur ({result.from || "inconnu"}) n'est pas dans ta liste d'expéditeurs : vérifie que le mail vient bien de la fac avant de valider.</p>}
          <button className="lien" onClick={() => onSource(result.id)}>Voir ce qui est gardé</button>
        </div>
      )}
    </section>
  );
}

function MailSource({ m, f, onClose, run }: { m: SharedMail; f: FacView; onClose: () => void; run: Run }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="voile" onClick={onClose}>
      <section className="carte source-mail" data-testid="source-mail" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Mail d'origine">
        <div className="titre-ligne"><h2>Mail d'origine</h2><button className="icone petit" onClick={onClose} title="Fermer"><IconClose size={16} /></button></div>
        <dl>
          <div><dt>De</dt><dd>{m.from || "inconnu"}</dd></div>
          <div><dt>Objet</dt><dd>{m.subject || "sans objet"}</dd></div>
          <div><dt>Envoyé</dt><dd>{m.date ? new Date(m.date).toLocaleString("fr-FR") : "date inconnue"}</dd></div>
          <div><dt>Partagé</dt><dd>{new Date(m.addedAt).toLocaleString("fr-FR")}</dd></div>
        </dl>
        <blockquote data-testid="extrait">{m.excerpt || "(pas de texte)"}</blockquote>
        <p className="aide">Seul cet extrait est gardé. Pour relire le mail entier, ouvre le webmail : l'objet est copié, colle-le dans la recherche.</p>
        <div className="ligne">
          <button className="bouton" onClick={() => void api.fac.openWebmail(m.subject)}>Ouvrir le webmail</button>
          <button className="lien danger" onClick={() => { run(api.fac.removeMail(m.id)); onClose(); }}>Oublier ce mail</button>
          <span className="version">{f.webmail.replace(/^https:\/\//, "").replace(/\/$/, "")}</span>
        </div>
      </section>
    </div>
  );
}

/** Réglages : adresse ADE, expéditeurs, données. */
export function FacSettings({ f, notify }: { f: FacView; notify: (t: string) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [senders, setSenders] = useState(f.allowedSenders.join("\n"));
  useEffect(() => setSenders(f.allowedSenders.join("\n")), [f.allowedSenders.join("\n")]);
  const save = async () => {
    setBusy(true);
    try { const v = await api.fac.setUrl(url); setUrl(""); notify(`Emploi du temps relié : ${v.courses.length} cours dans les 7 prochains jours.`); } catch (e) { notify(errText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="carte" data-testid="reglages-fac">
      <h2>Fac : Université de Rennes</h2>
      <p className="aide">
        <b>Emploi du temps.</b> Dans ADE (depuis l'ENT), coche tes groupes de CM et de TD, puis clique sur l'icône Partager → <b>Agenda</b>, choisis
        la fin du semestre comme date de fin et copie le lien. Ce lien donne accès à ton planning sans mot de passe : il reste sur ce PC et n'est jamais affiché en entier.
      </p>
      {f.configured && <p className="aide">Relié : <code>{f.url}</code>{f.lastFetch ? ` · dernier essai ${new Date(f.lastFetch).toLocaleString("fr-FR")}` : ""}</p>}
      <div className="ligne">
        <input type="password" autoComplete="off" spellCheck={false} data-testid="url-ade" className="large" placeholder={f.configured ? "Coller une nouvelle adresse pour la remplacer" : "https://…/jsp/custom/modules/plannings/….shu"} value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="bouton" disabled={busy || !url.trim()} onClick={save}>{busy ? "Vérification…" : "Relier"}</button>
      </div>
      <p className="aide">Actualisation à l'ouverture de la fenêtre (au plus toutes les 15 minutes) et avec le bouton ↻. Rien n'est téléchargé quand l'application est fermée.</p>

      <h3>Expéditeurs de la fac</h3>
      <p className="aide">Un par ligne : une adresse, ou <code>@univ-rennes.fr</code> pour tout le domaine. Un mail partagé venant d'ailleurs est signalé avant validation.</p>
      <textarea rows={3} value={senders} onChange={(e) => setSenders(e.target.value)} placeholder={"@univ-rennes.fr\nsecretariat-l3info@univ-rennes.fr"} />
      <button className="bouton secondaire" onClick={() => api.fac.setSenders(senders.split(/[\n,;]+/)).then(() => notify("Liste enregistrée.")).catch((e) => notify(errText(e)))}>Enregistrer la liste</button>

      <h3>Données gardées</h3>
      <p className="aide">
        Sur ce PC seulement (<code>fac.json</code>) : l'adresse ADE, les cours à venir, les changements repérés, et pour chaque mail partagé
        l'expéditeur, l'objet, la date et un extrait de quelques lignes (30 jours). Aucun mot de passe, aucun accès à ta boîte mail.
      </p>
      <p className="aide"><b>Sur iPhone :</b> ajoute la même adresse ADE dans Réglages → Calendrier (ou Apps → Calendrier) → Comptes → Ajouter un compte → Autre → « Ajouter un calendrier avec abonnement ». C'est iOS qui choisit quand il actualise. Les corrections et échéances tirées des mails restent sur ce PC.</p>
      <button className="lien danger" onClick={() => { if (confirm("Oublier l'adresse ADE, l'emploi du temps, les mails partagés et les échéances ?")) api.fac.forget().then(() => notify("Données Fac effacées.")); }}>Oublier toutes les données Fac</button>
    </div>
  );
}

const Svg = ({ children, size = 20 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
type P = { size?: number };
const IconRefresh = (p: P) => <Svg {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></Svg>;
const IconClose = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
const IconCheck = (p: P) => <Svg {...p}><path d="M5 12l5 5 9-10" /></Svg>;
const IconArrow = (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
const IconMail = (p: P) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></Svg>;
