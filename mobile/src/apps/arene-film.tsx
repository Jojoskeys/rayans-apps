// Arène animée (tuile Arène) : les 200 petits robots d'une vraie évolution (film.json) se promènent, grossissent quand
// leur règle gagne, la moitié la moins bonne meurt, les survivants font des enfants ; après la dernière génération,
// la championne passe l'examen sur l'année qu'elle n'a jamais vue, en course contre « acheter et garder ».
// Dessin en 2D sur un canvas (première version ; la 3D viendra plus tard).
import { useEffect, useRef, useState } from "react";
import { enTete, hasard, naissances, placeChampion, position, rangs, type Film } from "../shared/film.ts";
import { pourcent } from "../shared/arene.ts";

export const COULEURS = ["#5B8DEF", "#E3A33B", "#C77DDB", "#3BA776"];
const GEN = 3.2;          // secondes par génération : ils tradent, sélection, naissances
const SACRE = 3.5;        // la championne est couronnée
const EXAMEN = 7;         // la course sur l'année jamais vue
const FIN = 4;            // verdict affiché

function robot(c: CanvasRenderingContext2D, x: number, y: number, r: number, couleur: string, t: number, id: number, alpha = 1, gris = 0) {
  c.save();
  c.globalAlpha = alpha;
  const saut = Math.abs(Math.sin(t * 6 + hasard(id, 7) * 6)) * r * 0.25;
  y -= saut;
  // antenne
  c.strokeStyle = gris ? "#6b7280" : couleur; c.lineWidth = Math.max(1, r * 0.18);
  c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.25, y - r * 1.55); c.stroke();
  c.fillStyle = gris ? "#6b7280" : couleur;
  c.beginPath(); c.arc(x + r * 0.25, y - r * 1.6, r * 0.2, 0, 6.283); c.fill();
  // corps
  c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
  // yeux qui regardent où il va
  const dx = Math.sin(t * 0.8 + hasard(id, 5) * 6) * r * 0.12;
  c.fillStyle = "#fff";
  for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * r * 0.36 + dx, y - r * 0.12, r * 0.28, 0, 6.283); c.fill(); }
  c.fillStyle = "#111418";
  for (const s of [-1, 1]) {
    if (gris) { c.lineWidth = Math.max(1, r * 0.1); c.strokeStyle = "#111418"; const ex = x + s * r * 0.36 + dx, ey = y - r * 0.12, k = r * 0.14; c.beginPath(); c.moveTo(ex - k, ey - k); c.lineTo(ex + k, ey + k); c.moveTo(ex + k, ey - k); c.lineTo(ex - k, ey + k); c.stroke(); }
    else { c.beginPath(); c.arc(x + s * r * 0.36 + dx * 1.6, y - r * 0.1, r * 0.13, 0, 6.283); c.fill(); }
  }
  c.restore();
}

function couronne(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.save(); c.fillStyle = "#F5C542";
  c.beginPath(); c.moveTo(x - r, y); c.lineTo(x - r, y - r * 0.8); c.lineTo(x - r * 0.5, y - r * 0.35); c.lineTo(x, y - r);
  c.lineTo(x + r * 0.5, y - r * 0.35); c.lineTo(x + r, y - r * 0.8); c.lineTo(x + r, y); c.closePath(); c.fill(); c.restore();
}

export function ArenaFilm({ film }: { film: Film }) {
  const toile = useRef<HTMLCanvasElement>(null);
  const [lecture, setLecture] = useState(false);
  const [vitesse, setVitesse] = useState(1);
  const [texte, setTexte] = useState("Appuie sur ▶ pour lancer l'arène.");
  const etat = useRef({ t: 0, lecture: false, vitesse: 1 });
  etat.current.lecture = lecture; etat.current.vitesse = vitesse;
  const G = film.generations.length;
  const total = G * GEN + SACRE + EXAMEN + FIN;

  useEffect(() => {
    const cv = toile.current!;
    const c = cv.getContext("2d")!;
    let raf = 0, avant = performance.now(), dernierTexte = "";
    const rangsParGen = film.generations.map(rangs);
    const place = placeChampion(film);
    const champion = { id: film.champion.id, type: film.champion.type, entr: film.champion.entrainement };

    const dessiner = (maintenant: number) => {
      const dt = Math.min(0.1, (maintenant - avant) / 1000); avant = maintenant;
      const e = etat.current;
      if (e.lecture) e.t = Math.min(total, e.t + dt * e.vitesse);
      if (e.t >= total && e.lecture) setLecture(false);
      const dpr = window.devicePixelRatio || 1;
      const L = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(L * dpr)) { cv.width = Math.round(L * dpr); cv.height = Math.round(H * dpr); }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, L, H);
      // sol de l'arène
      c.fillStyle = "#151a21"; c.beginPath(); c.roundRect(0, 0, L, H, 16); c.fill();
      c.strokeStyle = "#2B313B"; c.lineWidth = 1;
      for (let k = 1; k < 6; k++) { c.beginPath(); c.moveTo(0, (H * k) / 6); c.lineTo(L, (H * k) / 6); c.stroke(); }
      const M = 18, HAUT = 58, R = Math.max(4, L / 75);
      const t = e.t, temps = t * 1.0;
      let msg = "";
      c.fillStyle = "#ECEFF3"; c.font = "600 15px -apple-system, system-ui, sans-serif"; c.textAlign = "left";

      if (t < G * GEN) {
        const g = Math.min(G - 1, Math.floor(t / GEN)), ph = t - g * GEN;
        const gen = film.generations[g], rg = rangsParGen[g];
        const best = enTete(gen);
        c.fillText(`Génération ${g + 1} / ${G}`, 14, 24);
        c.fillStyle = "#9AA3B2"; c.font = "13px -apple-system, system-ui, sans-serif";
        c.fillText(`En tête 👑 : ${pourcent(best[3])} sur ${film.entrainement}`, 14, 43);
        const morts = ph >= 1.6, naiss = ph >= 2.4;
        for (const a of gen) {
          const p = position(a[0], temps, L, H, M, HAUT);
          const taille = R * (0.65 + 0.9 * Math.min(1, ph / 1.2) * (rg.get(a[0]) ?? 0));
          if (!a[4] && morts) {
            const k = Math.min(1, (ph - 1.6) / 0.6);
            robot(c, p.x, p.y + k * 6, taille * (1 - 0.4 * k), COULEURS[a[2]], 0, a[0], 1 - k * 0.85, 1);
          } else robot(c, p.x, p.y, taille, COULEURS[a[2]], temps, a[0]);
        }
        if (naiss) {
          const k = Math.min(1, (ph - 2.4) / 0.6);
          for (const n of naissances(film.generations, g)) {
            const pp = position(n.parent, temps, L, H, M, HAUT), pe = position(n.id, temps, L, H, M, HAUT);
            robot(c, pp.x + (pe.x - pp.x) * k, pp.y + (pe.y - pp.y) * k, R * 0.65 * (0.3 + 0.7 * k), COULEURS[n.type], temps, n.id);
          }
        }
        const pb = position(best[0], temps, L, H, M, HAUT);
        couronne(c, pb.x, pb.y - R * 2.2, R * 0.9);
        msg = ph < 1.6 ? `Chaque robot applique sa règle sur les prix de ${film.entrainement}. Plus il gagne, plus il grossit.`
          : !naiss ? "La moitié la moins bonne meurt." : "Les survivants font des enfants, presque pareils qu'eux.";
      } else if (t < G * GEN + SACRE) {
        const k = Math.min(1, (t - G * GEN) / 1.2);
        c.fillText("La championne", 14, 24);
        c.fillStyle = "#9AA3B2"; c.font = "13px -apple-system, system-ui, sans-serif";
        c.fillText(`${pourcent(champion.entr)} sur ${film.entrainement} : elle a l'air géniale.`, 14, 43);
        for (const a of film.generations[G - 1]) if (place.ne || a[0] !== place.id) {
          const p = position(a[0], temps, L, H, M, HAUT); robot(c, p.x, p.y, R * 0.8, COULEURS[a[2]], temps, a[0], 1 - k * 0.85);
        }
        const p0 = position(place.id, temps, L, H, M, HAUT);
        const x = p0.x + (L / 2 - p0.x) * k, y = p0.y + (H * 0.6 - p0.y) * k, r = R * (1.2 + 2.3 * k);
        robot(c, x, y, r, COULEURS[champion.type], temps, champion.id);
        couronne(c, x, y - r * 2.1, r * 0.8);
        msg = `${place.ne ? "Née à la dernière génération. " : ""}Sa règle : ${film.champion.regle}`;
      } else {
        // L'examen : course sur l'année jamais vue.
        const te = Math.min(1, (t - G * GEN - SACRE) / EXAMEN);
        const ex = film.examen, n = ex.dates.length, i = Math.max(1, Math.round(te * (n - 1)));
        const vals = [...ex.champion, ...ex.ag, 0];
        const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.15 || 0.05;
        const X = (j: number) => M + (L - 2 * M - 40) * j / Math.max(1, n - 1);
        const Y = (v: number) => HAUT + 26 + (H - HAUT - 56) * (1 - (v - lo + pad) / (hi - lo + 2 * pad));
        c.fillText(`L'examen : ${film.test}, jamais vue`, 14, 24);
        c.fillStyle = "#9AA3B2"; c.font = "13px -apple-system, system-ui, sans-serif";
        c.font = "600 12px -apple-system, system-ui, sans-serif";
        const t1 = `● Championne ${pourcent(ex.champion[i])}`, t2 = `● Acheter et garder ${pourcent(ex.ag[i])}`;
        c.fillStyle = COULEURS[champion.type]; c.fillText(t1, 14, 44);
        c.fillStyle = "#4A9FD8"; c.fillText(t2, 14, 61);
        c.fillStyle = "#9AA3B2"; c.font = "12px -apple-system, system-ui, sans-serif"; c.textAlign = "right";
        c.fillText(ex.dates[i]?.split("-").reverse().join("/") ?? "", L - 14, H - 12); c.textAlign = "left";
        c.strokeStyle = "#2B313B"; c.beginPath(); c.moveTo(M, Y(0)); c.lineTo(L - M, Y(0)); c.stroke();
        const trace = (serie: number[], couleur: string) => {
          c.strokeStyle = couleur; c.lineWidth = 2.5; c.beginPath();
          for (let j = 0; j <= i; j++) j ? c.lineTo(X(j), Y(serie[j])) : c.moveTo(X(j), Y(serie[j]));
          c.stroke();
        };
        trace(ex.ag, "#4A9FD8");
        trace(ex.champion, COULEURS[champion.type]);
        robot(c, X(i), Y(ex.ag[i]), R * 1.2, "#4A9FD8", temps, -1);
        robot(c, X(i), Y(ex.champion[i]), R * 1.4, COULEURS[champion.type], temps, champion.id);
        couronne(c, X(i), Y(ex.champion[i]) - R * 3, R);
        const gagne = ex.champion[n - 1] > ex.ag[n - 1];
        msg = te < 1 ? "La championne joue sur une année qu'elle n'a jamais vue, sans rien changer à sa règle."
          : gagne ? `Elle gagne cette fois (${pourcent(ex.champion[n - 1])} contre ${pourcent(ex.ag[n - 1])}) : regarde les autres années dans le rapport avant d'y croire.`
            : `Sur le passé : ${pourcent(champion.entr)}. À l'examen : ${pourcent(ex.champion[n - 1])}, contre ${pourcent(ex.ag[n - 1])} sans rien faire. Elle avait appris le passé par cœur.`;
      }
      if (msg !== dernierTexte) { dernierTexte = msg; setTexte(msg); }
      raf = requestAnimationFrame(dessiner);
    };
    raf = requestAnimationFrame(dessiner);
    return () => cancelAnimationFrame(raf);
  }, [film]);

  const recommencer = () => { etat.current.t = 0; setLecture(true); };
  return (
    <>
      <canvas ref={toile} style={{ width: "100%", aspectRatio: "1 / 1.05", display: "block", borderRadius: 16 }} />
      <p style={{ minHeight: "3.9em" }}>{texte}</p>
      <div className="filtres">
        <button className="actif" onClick={() => (etat.current.t >= total ? recommencer() : setLecture(!lecture))}>{lecture ? "⏸ Pause" : "▶ Lancer"}</button>
        <button className={vitesse === 3 ? "actif" : ""} onClick={() => setVitesse(vitesse === 1 ? 3 : 1)}>Vitesse ×{vitesse === 1 ? 3 : 1}</button>
        <button onClick={recommencer}>↺ Recommencer</button>
      </div>
      <p className="petit">{film.types.map((ty, k) => <span key={ty}><span style={{ color: COULEURS[k] }}>●</span> {ty}{k < 3 ? " · " : ""}</span>)}</p>
    </>
  );
}
