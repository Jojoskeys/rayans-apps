// Travail profond par paliers, et journal des distractions.
import { useEffect, useRef, useState } from "react";
import type { Db, Distraction, SeanceTravail } from "../core/model";
import { newId } from "../core/rng";
import {
  apresSeance, bilanTravail, choisirPalier, INTENTION_PROPOSEE, issueSeance, MAX_DISTRACTIONS, minutesPalier, minutesPause, PALIERS,
  statsDistractions, TYPES_DISTRACTION, type TypeDistraction,
} from "../core/travail";
import { isTauri, ouvrirChrono } from "../storage";
import { Barre, Barres, Carte, fmtDate, fmtSec, plural, sonFin, useApp } from "../ui";

const nomType = (t: TypeDistraction) => TYPES_DISTRACTION.find((x) => x.id === t)!;

/** Bouton « Ouvrir Rayan's Chrono », seulement dans l'application de bureau. */
function BoutonChrono() {
  const [msg, setMsg] = useState("");
  if (!isTauri) return null;
  return (
    <span className="bouton-chrono">
      <button className="btn petit" onClick={async () => {
        try {
          setMsg((await ouvrirChrono()) ? "Rayan's Chrono s'ouvre…" : "Rayan's Chrono n'a pas été trouvé : installe-le ou ouvre-le depuis Rayan's Launcher.");
        } catch (e) { setMsg(String(e)); }
      }}>⏲ Ouvrir Rayan's Chrono</button>
      {msg && <small className="muted"> {msg}</small>}
    </span>
  );
}

/** Mini-formulaire « J'ai été distrait » : quoi, et une note facultative. */
function FormDistraction({ onNoter, onAnnuler }: { onNoter: (type: TypeDistraction, note: string) => void; onAnnuler: () => void }) {
  const [note, setNote] = useState("");
  return (
    <div className="form-distraction">
      <p><b>Qu'est-ce qui t'a distrait ?</b> <span className="muted petit">Pas grave : tu le notes et tu reviens.</span></p>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Une note (facultatif) : « penser à acheter du pain »…" maxLength={140} />
      <div className="choix">
        {TYPES_DISTRACTION.map((t) => <button key={t.id} className="btn" onClick={() => onNoter(t.id, note.trim())}>{t.icone} {t.nom}</button>)}
        <button className="btn petit" onClick={onAnnuler}>Annuler</button>
      </div>
    </div>
  );
}

function ajouterDistraction(d: Db, type: TypeDistraction, note: string, seanceId?: string): Db {
  const x: Distraction = { id: newId(), at: Date.now(), type, ...(note ? { note } : {}), ...(seanceId ? { seanceId } : {}) };
  return { ...d, distractions: [...d.distractions, x] };
}

interface EnCours { id: string; debut: number; minutes: number; objectif: string; intention: string; distractions: number }

// La séance en cours est gardée sur cet appareil : changer d'onglet ou recharger ne la perd pas.
const CLE_EN_COURS = "rayans-focus-travail-en-cours";
function lireEnCours(): EnCours | null {
  try {
    const x = JSON.parse(localStorage.getItem(CLE_EN_COURS) ?? "null") as EnCours | null;
    // Une séance oubliée depuis plus d'une journée n'a plus de sens.
    return x && typeof x.debut === "number" && Date.now() - x.debut < 86400_000 ? x : null;
  } catch { return null; }
}
function ecrireEnCours(x: EnCours | null) {
  try {
    if (x) localStorage.setItem(CLE_EN_COURS, JSON.stringify(x));
    else localStorage.removeItem(CLE_EN_COURS);
  } catch { /* stockage indisponible */ }
}

export default function PageTravail() {
  const { db, maj } = useApp();
  const palier = minutesPalier(db.travail);
  const [minutes, setMinutes] = useState(palier);
  const [objectif, setObjectif] = useState("");
  const [intention, setIntention] = useState(INTENTION_PROPOSEE);
  const [enCours, setEnCoursEtat] = useState<EnCours | null>(lireEnCours);
  const setEnCours = (x: EnCours | null) => { ecrireEnCours(x); setEnCoursEtat(x); };
  const [formOuvert, setFormOuvert] = useState(false);
  const [bilan, setBilan] = useState<{ s: SeanceTravail; avant: number; apres: number } | null>(null);
  const [pause, setPause] = useState<{ fin: number; dehors: boolean } | null>(null);
  const [now, setNow] = useState(Date.now());
  const termine = useRef(false);

  useEffect(() => {
    if (!enCours && !pause) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [enCours, pause]);

  // Avant de fermer la fenêtre en pleine séance : demander confirmation.
  useEffect(() => {
    if (!enCours) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [enCours]);

  const finir = (terminee: boolean) => {
    if (!enCours || termine.current) return;
    termine.current = true;
    const fin = Date.now();
    const issue = issueSeance(terminee, enCours.distractions);
    const s: SeanceTravail = {
      id: enCours.id, debut: enCours.debut, fin, minutes: enCours.minutes,
      faites: Math.min(enCours.minutes, Math.round(((fin - enCours.debut) / 60_000) * 10) / 10),
      objectif: enCours.objectif, intention: enCours.intention, issue, distractions: enCours.distractions,
      auPalier: enCours.minutes === PALIERS[db.travail.palier],
    };
    const avant = db.travail.palier;
    let apres = avant;
    maj((d) => {
      const travail = apresSeance(d.travail, s.minutes, issue, fin);
      apres = travail.palier;
      return { ...d, travaux: [...d.travaux, s], travail };
    });
    if (terminee) sonFin(db.reglages.sons);
    setBilan({ s, avant, apres });
    setEnCours(null);
    setFormOuvert(false);
    setMinutes(PALIERS[apres]);
  };

  useEffect(() => {
    if (enCours && now - enCours.debut >= enCours.minutes * 60_000) finir(true);
    // Fin de la pause : le même son discret, une seule fois.
    if (pause && now >= pause.fin && !termine.current) {
      termine.current = true;
      sonFin(db.reglages.sons);
    }
  });

  // ----- Pause proposée à la fin -----
  if (pause) {
    const reste = Math.max(0, Math.round((pause.fin - now) / 1000));
    return (
      <Carte titre={pause.dehors ? "🌳 Pause dehors" : "☕ Pause"} className="centre">
        <div className="minuteur petit-minuteur">{fmtSec(reste)}</div>
        <p>{pause.dehors ? "Sors prendre l'air, regarde loin, marche un peu. Laisse le téléphone dans ta poche." : "Lève-toi, bois de l'eau, regarde par la fenêtre. Évite les écrans si tu peux."}</p>
        <p className="muted petit">Les pauses courtes aident un peu (effet modeste) ; la nature, peut-être un peu plus. Voir « Fiches ».</p>
        <button className="btn primary" onClick={() => { setPause(null); termine.current = false; }}>{reste === 0 ? "Pause finie" : "Arrêter la pause"}</button>
      </Carte>
    );
  }

  // ----- Pendant la séance -----
  if (enCours) {
    const total = enCours.minutes * 60;
    const ecoule = Math.min(total, Math.floor((now - enCours.debut) / 1000));
    return (
      <div className="pile">
        <Carte className="seance-travail centre">
          <p className="muted">Objectif</p>
          <h2>{enCours.objectif || "Ma tâche"}</h2>
          <div className="minuteur">{fmtSec(total - ecoule)}</div>
          <Barre part={ecoule / total} />
          <p className="intention">« {enCours.intention} »</p>
          <p className="muted petit">Distractions notées : {enCours.distractions} {enCours.distractions > MAX_DISTRACTIONS ? "(c'est noté, continue quand même)" : `(jusqu'à ${MAX_DISTRACTIONS}, la séance compte comme réussie)`}</p>
          {formOuvert ? (
            <FormDistraction onAnnuler={() => setFormOuvert(false)} onNoter={(type, note) => {
              maj((d) => ajouterDistraction(d, type, note, enCours.id));
              setEnCours({ ...enCours, distractions: enCours.distractions + 1 });
              setFormOuvert(false);
            }} />
          ) : (
            <div className="choix">
              <button className="btn gros" onClick={() => setFormOuvert(true)}>J'ai été distrait</button>
              <button className="btn petit" onClick={() => { if (confirm("Arrêter la séance avant la fin ? Elle comptera comme abandonnée.")) finir(false); }}>Abandonner</button>
            </div>
          )}
        </Carte>
      </div>
    );
  }

  // ----- Bilan d'une séance -----
  if (bilan) {
    const { s, avant, apres } = bilan;
    const p = minutesPause(s.minutes);
    return (
      <Carte titre={s.issue === "reussie" ? "Séance réussie ✓" : s.issue === "distraite" ? "Séance terminée" : "Séance arrêtée"}>
        <p>
          {s.issue === "reussie" && `${s.minutes} minutes de travail profond, avec ${plural(s.distractions, "distraction notée", "distractions notées")}. Bien joué.`}
          {s.issue === "distraite" && `Tu es allé au bout des ${s.minutes} minutes, avec ${s.distractions} distractions notées. La séance compte, mais pas pour monter de palier.`}
          {s.issue === "abandonnee" && `Arrêtée après ${s.faites} min. Ce n'est pas un manque de volonté : la durée était peut-être trop longue pour aujourd'hui.`}
        </p>
        <p className="conseil">
          {!s.auPalier ? "Séance faite à une autre durée que ton palier : elle est gardée dans ton historique, sans changer de palier."
            : apres > avant ? `Nouveau palier : ${PALIERS[apres]} minutes (2 séances réussies de suite).`
              : apres < avant ? `On redescend au palier de ${PALIERS[apres]} minutes, pour réussir à nouveau avant d'allonger.`
                : s.issue === "reussie" && db.travail.serie === 1 ? `Encore une séance réussie à ${PALIERS[apres]} min et tu passes au palier suivant.`
                  : `Ton palier reste à ${PALIERS[apres]} minutes.`}
        </p>
        {s.issue !== "abandonnee" && (
          <>
            <p>Je te propose une pause de {p} minutes avant de reprendre :</p>
            <div className="choix">
              <button className="btn primary" onClick={() => { termine.current = false; setNow(Date.now()); setPause({ fin: Date.now() + p * 60_000, dehors: false }); setBilan(null); }}>☕ Pause de {p} min</button>
              <button className="btn primary" onClick={() => { termine.current = false; setNow(Date.now()); setPause({ fin: Date.now() + p * 60_000, dehors: true }); setBilan(null); }}>🌳 Sortir dehors {p} min</button>
              <button className="btn" onClick={() => { termine.current = false; setBilan(null); }}>Pas de pause</button>
            </div>
          </>
        )}
        {s.issue === "abandonnee" && <button className="btn primary" onClick={() => { termine.current = false; setBilan(null); }}>OK</button>}
        <p><BoutonChrono /></p>
      </Carte>
    );
  }

  // ----- Préparation -----
  const b = bilanTravail(db.travaux);
  return (
    <div className="pile">
      <Carte titre="⏱ Travail profond">
        <p className="muted petit">Un bloc de temps sur UNE vraie tâche (réviser, écrire, coder…), sans rien d'autre. Ton palier actuel : <b>{palier} min</b>{db.travail.serie ? ` (1 séance réussie, encore 1 pour passer à ${PALIERS[Math.min(PALIERS.length - 1, db.travail.palier + 1)]} min)` : ""}.</p>
        <div className="paliers">
          {PALIERS.map((m, k) => (
            <button key={m} className={`palier ${m === minutes ? "choisi" : ""} ${k === db.travail.palier ? "actuel" : ""}`} onClick={() => setMinutes(m)} title={k === db.travail.palier ? "Ton palier actuel" : undefined}>
              {m} min{k === db.travail.palier ? " ★" : ""}
            </button>
          ))}
        </div>
        {minutes !== palier && (
          <p className="muted petit">
            Tu choisis {minutes} min au lieu de ton palier ({palier} min) : la séance sera gardée, mais ne fera pas changer de palier.{" "}
            <button className="btn mini" onClick={() => maj((d) => ({ ...d, travail: choisirPalier(PALIERS.indexOf(minutes), Date.now()) }))}>Faire de {minutes} min mon palier</button>
          </p>
        )}
        <label className="champ">Mon objectif pour cette séance
          <input value={objectif} onChange={(e) => setObjectif(e.target.value)} placeholder="Ex. : faire les exercices 1 à 4 du chapitre 3" maxLength={160} />
        </label>
        <label className="champ">Mon intention « si… alors… »
          <input value={intention} onChange={(e) => setIntention(e.target.value)} maxLength={200} />
        </label>
        <p className="conseil petit">Avant de lancer : téléphone en silencieux et <b>hors de vue</b>, onglets inutiles fermés, de l'eau à côté. Une seule tâche.</p>
        <div className="choix">
          <button className="btn primary gros" disabled={!objectif.trim() || !intention.trim()} onClick={() => {
            termine.current = false;
            setNow(Date.now());
            setEnCours({ id: newId(), debut: Date.now(), minutes, objectif: objectif.trim(), intention: intention.trim(), distractions: 0 });
          }}>Lancer {minutes} min</button>
          <BoutonChrono />
        </div>
        {!objectif.trim() && <p className="muted petit centre">Écris ton objectif pour lancer la séance.</p>}
      </Carte>
      <Carte titre="Mes séances">
        <p className="muted petit">{plural(b.total, "séance", "séances")} · {b.reussies} réussie(s) · {b.minutes} min de travail profond en tout.</p>
        {db.travaux.length === 0 ? <p className="muted">Pas encore de séance. La première est la plus dure : 15 minutes suffisent.</p> : (
          <ul className="liste-seances">
            {db.travaux.slice(-12).reverse().map((s) => (
              <li key={s.id} className={s.issue}>
                <span>{s.issue === "reussie" ? "✓" : s.issue === "distraite" ? "~" : "✗"}</span>
                <b>{s.objectif || "Séance"}</b>
                <em>{fmtDate(s.debut)} · {s.faites}/{s.minutes} min · {plural(s.distractions, "distraction", "distractions")}</em>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </div>
  );
}

// ----- Journal des distractions -----------------------------------------------------------------------------
export function PageJournal() {
  const { db, maj } = useApp();
  const [form, setForm] = useState(false);
  const st = statsDistractions(db.distractions);
  const heures = Array.from({ length: 24 }, (_, h) => `${h}h`);
  return (
    <div className="pile">
      <Carte titre="📓 Journal des distractions">
        <p className="muted petit">Tout ce que tu as noté avec « J'ai été distrait ». Le but n'est pas de te juger, mais de voir ce qui revient, pour l'enlever de ton chemin.</p>
        {form ? (
          <FormDistraction onAnnuler={() => setForm(false)} onNoter={(type, note) => { maj((d) => ajouterDistraction(d, type, note)); setForm(false); }} />
        ) : (
          <button className="btn" onClick={() => setForm(true)}>Noter une distraction maintenant</button>
        )}
      </Carte>
      {st.total > 0 && (
        <Carte titre="En chiffres">
          <p>{plural(st.total, "distraction notée", "distractions notées")}{st.principal ? <> · la plus fréquente : <b>{nomType(st.principal).icone} {nomType(st.principal).nom.toLowerCase()}</b></> : null}{st.heurePire !== null ? <> · l'heure la plus touchée : <b>{st.heurePire} h</b></> : null}.</p>
          <div className="stats-types">
            {TYPES_DISTRACTION.map((t) => (
              <div key={t.id} className="stat-type">
                <span>{t.icone} {t.nom}</span>
                <Barre part={st.parType[t.id] / st.total} />
                <b>{st.parType[t.id]}</b>
              </div>
            ))}
          </div>
          <p className="muted petit">Par heure de la journée :</p>
          <Barres valeurs={st.parHeure} etiquettes={heures} />
          {st.principal === "telephone" && <p className="conseil petit">Le téléphone revient le plus : pendant tes blocs, mets-le dans une autre pièce ou dans un tiroir.</p>}
          {st.principal === "pensee" && <p className="conseil petit">Ce sont surtout des pensées : garde une feuille à côté, écris la pensée en 3 mots, et reviens. Tu t'en occuperas après.</p>}
          {st.principal === "bruit" && <p className="conseil petit">Surtout des bruits : essaie des bouchons d'oreilles, un casque, ou un autre endroit.</p>}
          {st.principal === "personne" && <p className="conseil petit">Surtout des personnes : préviens avant ton bloc (« je suis occupé 25 min ») ou ferme la porte.</p>}
        </Carte>
      )}
      <Carte titre="Les dernières">
        {db.distractions.length === 0 ? <p className="muted">Rien de noté pour l'instant.</p> : (
          <ul className="journal">
            {db.distractions.slice(-40).reverse().map((d) => (
              <li key={d.id}>
                <span>{nomType(d.type).icone}</span>
                <b>{nomType(d.type).nom}</b>
                {d.note && <span className="muted">« {d.note} »</span>}
                <em>{new Date(d.at).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</em>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </div>
  );
}
