// Journal privé : émotions nommées, gratitudes, écrits gardés avant un moment stressant.
import { useState, type ReactNode } from "react";
import { famille, QUESTIONS_REEVAL } from "../core/emotions";
import type { Db } from "../core/model";
import { Carte, fmtDate, useApp } from "../ui";

type Ligne =
  | { genre: "entree"; at: number; id: string }
  | { genre: "gratitude"; at: number; id: string }
  | { genre: "preparation"; at: number; id: string };

function lignes(db: Db): Ligne[] {
  const l: Ligne[] = [
    ...db.entrees.filter((e) => !e.supprime).map((e) => ({ genre: "entree" as const, at: e.at, id: e.id })),
    ...db.gratitudes.filter((g) => !g.supprime).map((g) => ({ genre: "gratitude" as const, at: g.at, id: g.id })),
    ...db.preparations.filter((p) => !p.supprime && p.texte).map((p) => ({ genre: "preparation" as const, at: p.at, id: p.id })),
  ];
  return l.sort((a, b) => b.at - a.at);
}

export default function PageJournal() {
  const { db, maj, aller } = useApp();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const liste = lignes(db);
  const supprimer = (l: Ligne) => {
    if (!confirm("Effacer cette entrée du journal ?")) return;
    const now = Date.now();
    maj((d) => {
      if (l.genre === "entree") return { ...d, entrees: d.entrees.map((e) => (e.id === l.id ? { ...e, situation: "", pensee: "", reponses: {}, equilibree: "", supprime: true, maj: now } : e)) };
      if (l.genre === "gratitude") return { ...d, gratitudes: d.gratitudes.map((g) => (g.id === l.id ? { ...g, choses: [], supprime: true, maj: now } : g)) };
      return { ...d, preparations: d.preparations.map((p) => (p.id === l.id ? { id: p.id, at: p.at, jour: p.jour, supprime: true, maj: now } : p)) };
    });
  };
  return (
    <div className="pile">
      <Carte titre="Mon journal">
        <p className="muted petit">🔒 Ton journal est privé : il reste sur cet appareil (et dans ta synchronisation privée entre ton PC et ton téléphone). Il n'est envoyé nulle part ailleurs.</p>
        {liste.length === 0 && (
          <>
            <p>Rien pour l'instant. Tes émotions nommées et tes « 3 choses bien » apparaîtront ici.</p>
            <div className="choix"><button className="btn" onClick={() => aller("exercices", "nommer")}>Nommer une émotion</button><button className="btn" onClick={() => aller("exercices", "gratitude")}>3 choses bien</button></div>
          </>
        )}
      </Carte>
      <ul className="journal">
        {liste.map((l) => {
          const cle = `${l.genre}-${l.id}`;
          const ouv = ouvert === cle;
          let titre = "";
          let corps: ReactNode = null;
          if (l.genre === "entree") {
            const e = db.entrees.find((x) => x.id === l.id)!;
            const f = famille(e.famille);
            titre = `${f?.icone ?? "•"} ${f?.nom ?? e.famille}${e.nuance ? ` (${e.nuance})` : ""} · ${e.intensite}${e.apres !== null ? ` → ${e.apres}` : ""}`;
            corps = (
              <>
                {e.situation && <p><b>Situation :</b> {e.situation}</p>}
                {e.pensee && <p><b>Pensée :</b> {e.pensee}</p>}
                {QUESTIONS_REEVAL.filter((q) => e.reponses[q.id]).map((q) => <p key={q.id}><b>{q.question}</b> {e.reponses[q.id]}</p>)}
                {e.equilibree && <p className="dans-app"><b>Pensée plus équilibrée :</b> {e.equilibree}</p>}
              </>
            );
          } else if (l.genre === "gratitude") {
            const g = db.gratitudes.find((x) => x.id === l.id)!;
            titre = `🌱 ${g.choses.map((c) => c.quoi).join(" · ")}`;
            corps = <ul className="guide">{g.choses.map((c, i) => <li key={i}><b>{c.quoi}</b>{c.pourquoi ? ` : ${c.pourquoi}` : ""}</li>)}</ul>;
          } else {
            const p = db.preparations.find((x) => x.id === l.id)!;
            titre = "⏳ Avant un moment stressant";
            corps = <p className="texte-libre">{p.texte}</p>;
          }
          return (
            <li key={cle} className="carte">
              <button className="fiche-tete" onClick={() => setOuvert(ouv ? null : cle)} aria-expanded={ouv}>
                <span className="muted petit">{fmtDate(l.at)}</span> <span className="titre-ligne">{titre}</span> <em>{ouv ? "▾" : "▸"}</em>
              </button>
              {ouv && <div className="corps">{corps}<div className="choix"><button className="btn petit" onClick={() => supprimer(l)}>Effacer</button></div></div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
