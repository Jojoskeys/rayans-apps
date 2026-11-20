// Rayan's Arène sur l'iPhone (et dans le navigateur du PC) : le plan mensuel « X € chaque mois sur un ETF monde du
// PEA », calculé ici à partir des prix publics publiés chaque semaine (arene/publier.py → ./prix.json), et l'Arène
// des robots (./resume.json, ./rapports/<actif>.html). Argent fictif, rien n'est envoyé, rien de personnel.
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { mountChrome } from "../shared/chrome.ts";
import { nettoyerFilm, type Film } from "../shared/film.ts";
import { ArenaFilm } from "./arene-film.tsx";
import { dateFr, euros, nettoyerPrix, planMensuel, pourcent, type Plan, type PrixArene, type ResumeArene } from "../shared/arene.ts";
import "./telecommande.css";
import "./petites.css";

const MONTANTS = [25, 50, 100, 200, 500];

function Graphe({ plan }: { plan: Plan }) {
  const L = 340, H = 170, M = 8;
  const pts = plan.points;
  const max = Math.max(1, ...pts.map((p) => Math.max(p.valeur, p.verse, p.livret)));
  const ligne = (f: (p: (typeof pts)[number]) => number) =>
    pts.map((p, i) => `${(M + (L - 2 * M) * i / Math.max(1, pts.length - 1)).toFixed(1)},${(H - M - (H - 2 * M) * f(p) / max).toFixed(1)}`).join(" ");
  // début de chaque année civile (la première, souvent entamée, est sautée) ; une étiquette sur deux plus bas
  const annees = pts.map((p, i) => ({ an: p.date.slice(0, 4), i })).filter((x, k, t) => k > 0 && x.an !== t[k - 1].an);
  return (
    <svg viewBox={`0 0 ${L} ${H + 16}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Valeur du plan, argent versé et Livret A">
      <line x1={M} x2={L - M} y1={H - M} y2={H - M} stroke="var(--bord)" />
      <polyline points={ligne((p) => p.livret)} fill="none" stroke="#4A9FD8" strokeWidth="1.6" />
      <polyline points={ligne((p) => p.verse)} fill="none" stroke="var(--texte-2)" strokeWidth="1.4" strokeDasharray="4 3" />
      <polyline points={ligne((p) => p.valeur)} fill="none" stroke="var(--orange)" strokeWidth="2.2" />
      {annees.filter((_, k) => k % 2 === 0).map((x) => (
        <text key={x.an} x={M + (L - 2 * M) * x.i / Math.max(1, pts.length - 1)} y={H + 12} fontSize="10" fill="var(--texte-2)" textAnchor="middle">{x.an}</text>
      ))}
    </svg>
  );
}

function App() {
  const [prix, setPrix] = useState<PrixArene | null | "absent">(null);
  const [resume, setResume] = useState<ResumeArene | null>(null);
  const [montant, setMontant] = useState(100);
  const [film, setFilm] = useState<Film | null>(null);
  useEffect(() => {
    void fetch("./prix.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).then((j) => setPrix(nettoyerPrix(j) ?? "absent")).catch(() => setPrix("absent"));
    void fetch("./film.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).then((j) => setFilm(nettoyerFilm(j))).catch(() => setFilm(null));
    void fetch("./resume.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).then((j) => setResume(j && Array.isArray(j.robots) ? j : null)).catch(() => setResume(null));
  }, []);
  const plan = useMemo(() => (prix && prix !== "absent" ? planMensuel(prix.dates, prix.prix, montant) : null), [prix, montant]);

  return (
    <div className="tc">
      <h1>Arène</h1>
      <p className="petit">Argent fictif, sur des prix passés réels. Pour apprendre, pas un conseil d'investissement.</p>

      {film && (
        <section className="carte">
          <h2>L'arène des robots</h2>
          <p>Une vraie évolution : 200 robots, chacun avec sa règle d'achat et de vente, s'entraînent sur la bourse américaine ({film.entrainement}).</p>
          <ArenaFilm film={film} />
        </section>
      )}

      <section className="carte">
        <h2>Plan mensuel</h2>
        <p>Et si tu avais versé chaque mois la même somme sur un ETF monde de ton PEA, sans jamais vendre ?</p>
        <div className="filtres">
          {MONTANTS.map((m) => <button key={m} className={m === montant ? "actif" : ""} onClick={() => setMontant(m)}>{m} €/mois</button>)}
        </div>
        {prix === null && <p>Chargement…</p>}
        {prix === "absent" && <p>Les prix ne sont pas encore publiés : ils arrivent avec la prochaine mise à jour de Rayan's Mobile (chaque lundi).</p>}
        {prix && prix !== "absent" && plan && (
          <>
            <p style={{ color: "var(--texte)", fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>
              Versé {euros(plan.verse)}, ça vaudrait {euros(plan.valeur)}{" "}
              <span style={{ color: plan.valeur >= plan.verse ? "var(--vert)" : "var(--rouge)" }}>({plan.valeur >= plan.verse ? "+" : "−"}{euros(Math.abs(plan.valeur - plan.verse))})</span>
            </p>
            <p className="petit">{prix.nom}, depuis le {dateFr(prix.dates[0])} ({plan.mois} mois). Parts entières comme sur un PEA : quand une part coûte plus que ton versement, l'argent attend. Frais 0,5 % par achat, 1 € minimum ({euros(plan.frais)} en {plan.achats} achats).</p>
            <Graphe plan={plan} />
            <p className="petit"><span style={{ color: "var(--orange)" }}>━</span> ton ETF · <span>┅</span> argent versé · <span style={{ color: "#4A9FD8" }}>━</span> même argent sur un Livret A ({euros(plan.livret)})</p>
          </>
        )}
      </section>

      {plan && (
        <section className="carte">
          <h2>Les montagnes russes</h2>
          <p><b style={{ color: "var(--texte)" }}>Pire chute :</b> l'ETF a perdu {pourcent(plan.chute).replace("−", "")} entre le {dateFr(plan.chuteDebut)} et le {dateFr(plan.chuteBas)}
            {plan.chuteRetour ? <>, et il a fallu <b style={{ color: "var(--texte)" }}>{plan.moisPourRemonter} mois</b> pour remonter.</> : ", et il n'est pas encore remonté."}</p>
          {plan.pireValeur < plan.pireVerse
            ? <p><b style={{ color: "var(--texte)" }}>Pire moment pour toi :</b> le {dateFr(plan.pireDate)}, tu avais versé {euros(plan.pireVerse)} et ça valait {euros(plan.pireValeur)}. C'est là que beaucoup vendent… et ratent la remontée.</p>
            : <p>Ton plan n'est jamais passé sous ce que tu avais versé : rare, ne compte pas dessus.</p>}
          <p>Le passé ne garantit rien. N'y mets que de l'argent dont tu n'auras pas besoin avant 5 à 8 ans, après une épargne de côté.</p>
        </section>
      )}

      <section className="carte">
        <h2>Les robots</h2>
        <p>200 petites règles d'achat et de vente s'entraînent sur 3 ans de prix, les moins bonnes « meurent ». Puis la championne passe « l'examen » sur l'année d'après, qu'elle n'a jamais vue.</p>
        {!resume && <p className="petit">Les résultats arrivent avec la prochaine mise à jour (chaque lundi).</p>}
        {resume?.robots.map((r) => (
          <div key={r.actif} style={{ borderTop: "1px solid var(--bord)", paddingTop: 10 }}>
            <p style={{ color: "var(--texte)", fontWeight: 600 }}>{r.nom} · {r.ans.toLocaleString("fr-FR")} années jamais vues</p>
            <p>Robots {pourcent(r.arene)} · hasard {pourcent(r.hasard)} · <b style={{ color: "var(--texte)" }}>acheter et garder {pourcent(r.ag)}</b></p>
            <a className="lien accent" style={{ padding: 0 }} href={`./rapports/${encodeURIComponent(r.actif)}.html`}>Voir le rapport complet →</a>
          </div>
        ))}
        {resume && <p className="petit">Mis à jour le {dateFr(resume.genere)}.</p>}
      </section>
    </div>
  );
}

mountChrome([]);
createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
