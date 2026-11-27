// Morceaux communs aux exercices : bilan de fin de manche, explication d'un mot après une réponse.
import { RADICAUX } from "../core/contenu-zh";
import { lettresRacine } from "../core/arabe";
import { motsVus } from "../core/seance";
import type { Mot } from "../core/langues";
import { mancheReussie } from "../core/niveaux";
import { BoutonEcoute, Carte, Lecture, useApp } from "../ui";

export function Bilan({ titre, score, max, niveau, continuer, texteContinuer = "Continuer" }: { titre: string; score: number; max: number; niveau?: number; continuer: () => void; texteContinuer?: string }) {
  const ok = mancheReussie(score, max);
  return (
    <Carte titre={`${titre} — fini`}>
      <p className="verdict">{score} / {max}</p>
      {niveau !== undefined && (
        <p className="muted petit" style={{ textAlign: "center" }}>
          {ok ? "Manche réussie (80 % ou plus). Deux réussites de suite font monter d'un niveau." : "En dessous de 80 % : le niveau baisse d'un cran pour la prochaine fois. C'est normal, c'est fait pour."}
        </p>
      )}
      <div className="choix"><button className="btn primary" onClick={continuer} autoFocus>{texteContinuer}</button></div>
    </Carte>
  );
}

/** Ce qui aide à retenir un mot : radical (chinois), racine et famille (arabe), mot-clé. */
export function Aides({ m }: { m: Mot }) {
  const { db } = useApp();
  const rad = m.radical ? RADICAUX.find((r) => r.r === m.radical) : undefined;
  const famille = m.racine ? motsVus(db, m.langue).filter((x) => x.id !== m.id && x.racine === m.racine) : [];
  return (
    <>
      {rad && <p className="astuce petit">Radical <span className="zh">{rad.r}</span> ({rad.nom}) : {rad.sens}.</p>}
      {m.racine && (
        <p className="astuce petit">
          Racine <span className="ar">{lettresRacine(m.racine).join(" ")}</span>
          {famille.length > 0 && <> — même famille : {famille.slice(0, 4).map((x) => <span key={x.id}><span className="ar">{x.ecrit}</span> ({x.fr}) </span>)}</>}
        </p>
      )}
      {m.cle && <p className="astuce petit">💡 Mot-clé : {m.cle}</p>}
    </>
  );
}

/** Le mot avec sa lecture, son sens et le bouton d'écoute. */
export function Correction({ m }: { m: Mot }) {
  return (
    <div>
      <Lecture langue={m.langue} texte={m.lecture} />
      <p className="sens-fr">{m.fr}</p>
      <div className="choix"><BoutonEcoute texte={m.ecrit} langue={m.langue} /></div>
      <Aides m={m} />
    </div>
  );
}
