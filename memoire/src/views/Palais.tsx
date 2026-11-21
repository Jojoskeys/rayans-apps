// Palais de mémoire : construction guidée (tes vrais lieux, dans l'ordre), promenade de vérification,
// listes personnelles rangées dedans et révisées à intervalles croissants, export vers Rayan's Révision.
import { useState } from "react";
import { IDEES_LIEUX, memeMot } from "../core/contenu";
import { listesDues, prochaineRevision } from "../core/espacement";
import type { Lieu, Liste, Palais } from "../core/model";
import { newId } from "../core/rng";
import { Rangement, Rappel, RevisionListe } from "../rangement";
import { saveExportFile } from "../storage";
import { Carte, fmtDate, plural, useApp } from "../ui";

const ETAPES_GUIDE = [
  "Choisis un lieu que tu connais par cœur : ton appartement, la maison de tes parents, ton trajet vers la fac.",
  "Commence par l'entrée, puis avance toujours dans le même sens (par exemple vers la droite, dans le sens des aiguilles d'une montre).",
  "Prends des endroits bien différents les uns des autres (pas 5 portes identiques), assez gros pour y poser un objet.",
  "Vise 10 lieux pour commencer, puis 20. Un lieu = un élément à retenir.",
];

export function ConstruirePalais({ existant, onFin, onAnnuler }: { existant?: Palais; onFin: (p: Palais) => void; onAnnuler?: () => void }) {
  const { maj } = useApp();
  const [nom, setNom] = useState(existant?.nom ?? "Mon appartement");
  const [lieux, setLieux] = useState<Lieu[]>(existant?.lieux ?? []);
  const [nouveau, setNouveau] = useState("");
  const [detail, setDetail] = useState("");
  const ajouter = (n: string, d = "") => {
    const t = n.trim();
    if (!t) return;
    if (lieux.some((l) => memeMot(l.nom, t))) return;
    setLieux([...lieux, { id: newId(), nom: t, ...(d.trim() ? { detail: d.trim() } : {}) }]);
    setNouveau("");
    setDetail("");
  };
  const bouger = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= lieux.length) return;
    const l = lieux.slice();
    [l[i], l[j]] = [l[j], l[i]];
    setLieux(l);
  };
  const enregistrer = () => {
    const now = Date.now();
    const p: Palais = existant ? { ...existant, nom: nom.trim() || "Palais", lieux, updatedAt: now } : { id: newId(), nom: nom.trim() || "Palais", lieux, createdAt: now, updatedAt: now };
    maj((d) => ({ ...d, palais: existant ? d.palais.map((x) => (x.id === p.id ? p : x)) : [...d.palais, p] }));
    onFin(p);
  };
  const idees = IDEES_LIEUX.filter((x) => !lieux.some((l) => memeMot(l.nom, x))).slice(0, 10);
  return (
    <Carte titre={existant ? `Modifier « ${existant.nom} »` : "Construis ton palais"}>
      {!existant && <ol className="guide">{ETAPES_GUIDE.map((e) => <li key={e}>{e}</li>)}</ol>}
      <label className="champ">Nom du palais <input value={nom} onChange={(e) => setNom(e.target.value)} /></label>
      <div className="ajout-lieu">
        <input value={nouveau} placeholder={`Lieu n° ${lieux.length + 1} (ex. : ${lieux.length === 0 ? "porte d'entrée" : "canapé"})`} onChange={(e) => setNouveau(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ajouter(nouveau, detail); }} autoFocus />
        <input value={detail} placeholder="Détail qui le rend unique (facultatif)" onChange={(e) => setDetail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ajouter(nouveau, detail); }} />
        <button className="btn" onClick={() => ajouter(nouveau, detail)}>Ajouter</button>
      </div>
      {idees.length > 0 && <div className="idees"><span className="muted petit">Idées :</span>{idees.map((x) => <button key={x} className="puce" onClick={() => ajouter(x)}>+ {x}</button>)}</div>}
      <ol className="lieux">
        {lieux.map((l, i) => (
          <li key={l.id}>
            <span className="num">{i + 1}</span>
            <span className="nom">{l.nom}{l.detail && <em className="muted"> — {l.detail}</em>}</span>
            <button className="btn mini" onClick={() => bouger(i, -1)} aria-label="Monter">↑</button>
            <button className="btn mini" onClick={() => bouger(i, 1)} aria-label="Descendre">↓</button>
            <button className="btn mini" onClick={() => setLieux(lieux.filter((x) => x.id !== l.id))} aria-label="Retirer">✕</button>
          </li>
        ))}
      </ol>
      <p className="muted petit">{lieux.length < 5 ? `Encore ${5 - lieux.length} lieux au minimum.` : lieux.length < 10 ? "C'est un début ; 10 lieux, c'est mieux." : lieux.length < 20 ? "Très bien. Tu pourras l'agrandir à 20 lieux en semaine 2." : "Parfait pour des listes de 20."}</p>
      <div className="choix">
        {onAnnuler && <button className="btn" onClick={onAnnuler}>Annuler</button>}
        <button className="btn primary" disabled={lieux.length < 5} onClick={enregistrer}>Enregistrer ({lieux.length} lieux)</button>
      </div>
    </Carte>
  );
}

/** Promenade : redonner les lieux dans l'ordre, pour vérifier qu'on connaît bien son palais. */
function Promenade({ palais, onFin }: { palais: Palais; onFin: () => void }) {
  const [res, setRes] = useState<boolean[] | null>(null);
  const reperes = palais.lieux.map((_, i) => (i === 0 ? "Premier lieu" : `Après « ${palais.lieux[i - 1].nom} »`));
  if (!res)
    return (
      <Carte titre={`Promenade dans « ${palais.nom} »`}>
        <p className="muted petit">Ferme les yeux, fais la visite, puis écris chaque lieu. Ça doit devenir automatique avant d'y ranger des listes.</p>
        <Rappel elements={palais.lieux.map((l) => l.nom)} reperes={reperes} consigne="Écris chaque lieu, dans l'ordre de la visite." onFin={setRes} />
      </Carte>
    );
  const n = res.filter(Boolean).length;
  return (
    <Carte titre="Promenade terminée">
      <div className={`verdict ${n === res.length ? "ok" : "moyen"}`}>{n} / {res.length} lieux dans l'ordre</div>
      {n < res.length && <p>À revoir : {palais.lieux.filter((_, i) => !res[i]).map((l) => l.nom).join(", ")}. Refais la visite en t'arrêtant sur eux.</p>}
      <button className="btn primary" onClick={onFin} autoFocus>Continuer</button>
    </Carte>
  );
}

function NouvelleListe({ onFin }: { onFin: () => void }) {
  const { db } = useApp();
  const palais = db.palais.filter((p) => !p.deleted);
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [palaisId, setPalaisId] = useState(palais[0]?.id ?? "");
  const [go, setGo] = useState(false);
  const elements = texte.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const p = palais.find((x) => x.id === palaisId);
  if (go && p)
    return (
      <Rangement
        titre={titre || "Ma liste"}
        elements={elements}
        reperes={p.lieux.slice(0, elements.length).map((l) => l.nom)}
        conseil="Pour chaque élément, invente une image qui agit sur le lieu : énorme, bruyante, qui sent, qui casse. Un mot abstrait ? Prends un objet qui le représente ou un mot qui sonne pareil."
        garder={{ titre: titre || "Ma liste", sorte: "perso", palaisId: p.id }}
        onFin={onFin}
      />
    );
  return (
    <Carte titre="Ranger ma liste dans un palais">
      <p className="muted petit">Une liste dans l'ordre : le plan d'un cours, les étapes d'une méthode, des dates, une liste de courses, l'ordre des sourates que tu apprends… Un élément par ligne.</p>
      <label className="champ">Titre <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. : Plan du chapitre 3" /></label>
      <textarea rows={8} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={"Premier élément\nDeuxième élément\n…"} />
      <label className="champ">Palais
        <select value={palaisId} onChange={(e) => setPalaisId(e.target.value)}>
          {palais.map((x) => <option key={x.id} value={x.id}>{x.nom} ({x.lieux.length} lieux)</option>)}
        </select>
      </label>
      {p && elements.length > p.lieux.length && <p className="ko-texte petit">Ce palais n'a que {p.lieux.length} lieux pour {elements.length} éléments : ajoute des lieux ou coupe la liste en deux.</p>}
      <div className="choix">
        <button className="btn" onClick={onFin}>Annuler</button>
        <button className="btn primary" disabled={!p || elements.length < 2 || elements.length > p.lieux.length} onClick={() => setGo(true)}>Ranger ({elements.length} éléments)</button>
      </div>
    </Carte>
  );
}

function exportRevision(l: Liste, p: Palais | undefined): string {
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return l.elements
    .map((e, i) => {
      const q = l.reperes?.[i] ?? (p ? `${l.titre} — ${p.nom}, lieu ${i + 1} (${p.lieux[i]?.nom ?? "?"})` : `${l.titre} — élément ${i + 1}`);
      return `${esc(q)};${esc(l.images[i] ? `${e} (image : ${l.images[i]})` : e)}`;
    })
    .join("\n");
}

export default function PagePalais() {
  const { db, maj } = useApp();
  const [vue, setVue] = useState<{ k: "liste" } | { k: "creer" } | { k: "modifier"; p: Palais } | { k: "promenade"; p: Palais } | { k: "nouvelle" } | { k: "reviser"; l: Liste }>({ k: "liste" });
  const [msg, setMsg] = useState("");
  const retour = () => setVue({ k: "liste" });
  const palais = db.palais.filter((p) => !p.deleted);
  const listes = db.listes.filter((l) => !l.deleted).sort((a, b) => b.createdAt - a.createdAt);
  const now = Date.now();
  const dues = listesDues(db.listes, now);
  if (vue.k === "creer") return <ConstruirePalais onFin={(p) => setVue({ k: "promenade", p })} onAnnuler={retour} />;
  if (vue.k === "modifier") return <ConstruirePalais existant={vue.p} onFin={retour} onAnnuler={retour} />;
  if (vue.k === "promenade") return <Promenade palais={vue.p} onFin={retour} />;
  if (vue.k === "nouvelle") return <NouvelleListe onFin={retour} />;
  if (vue.k === "reviser") return <RevisionListe liste={vue.l} onFin={retour} />;
  return (
    <div className="pile">
      <Carte titre="Mes palais">
        {palais.length === 0 && <p>Tu n'as pas encore de palais. C'est la base de tout le programme : commence par là (5 minutes).</p>}
        <ul className="palais-liste">
          {palais.map((p) => (
            <li key={p.id}>
              <div><b>{p.nom}</b> <span className="muted">— {plural(p.lieux.length, "lieu", "lieux")}</span><div className="muted petit">{p.lieux.map((l) => l.nom).join(" → ")}</div></div>
              <div className="choix">
                <button className="btn petit" onClick={() => setVue({ k: "promenade", p })}>Promenade</button>
                <button className="btn petit" onClick={() => setVue({ k: "modifier", p })}>Modifier</button>
                <button className="btn petit" onClick={() => { if (confirm(`Supprimer le palais « ${p.nom} » ? Les listes rangées dedans restent, avec des lieux numérotés.`)) maj((d) => ({ ...d, palais: d.palais.map((x) => (x.id === p.id ? { ...x, deleted: true, updatedAt: Date.now() } : x)) })); }}>Supprimer</button>
              </div>
            </li>
          ))}
        </ul>
        <div className="choix">
          <button className="btn primary" onClick={() => setVue({ k: "creer" })}>+ Nouveau palais</button>
          {palais.length > 0 && <button className="btn" onClick={() => setVue({ k: "nouvelle" })}>Ranger ma propre liste</button>}
        </div>
      </Carte>
      <Carte titre={`Mes listes${dues.length ? ` — ${dues.length} à réviser` : ""}`}>
        {listes.length === 0 && <p className="muted">Les listes que tu ranges (exercices du jour ou listes à toi) apparaissent ici, avec leur prochaine révision.</p>}
        <ul className="listes">
          {listes.map((l) => {
            const p = db.palais.find((x) => x.id === l.palaisId);
            const due = l.due !== null && l.due <= now;
            return (
              <li key={l.id} className={due ? "due" : ""}>
                <div>
                  <b>{l.titre}</b> <span className="muted petit">({l.elements.length}, {fmtDate(l.createdAt)}{p ? `, ${p.nom}` : ""})</span>
                  <div className="muted petit">{prochaineRevision(l, now, db.reglages.heureJour)}{l.rappels.length ? ` — dernier rappel ${Math.round(l.rappels[l.rappels.length - 1].part * 100)} %` : ""}</div>
                </div>
                <div className="choix">
                  <button className={`btn petit ${due ? "primary" : ""}`} onClick={() => setVue({ k: "reviser", l })}>Réviser</button>
                  <button className="btn petit" title="Fichier CSV à importer dans Rayan's Révision" onClick={async () => { const f = await saveExportFile(`${l.titre.replace(/[<>:"/\\|?*]/g, "-")}.csv`, exportRevision(l, p)); if (f) setMsg(`Exporté : ${f}. Dans Rayan's Révision, fais « Importer » et choisis ce fichier.`); }}>Vers Révision</button>
                  <button className="btn petit" onClick={() => { if (confirm(`Supprimer la liste « ${l.titre} » ?`)) maj((d) => ({ ...d, listes: d.listes.map((x) => (x.id === l.id ? { ...x, deleted: true, updatedAt: Date.now() } : x)) })); }}>✕</button>
                </div>
              </li>
            );
          })}
        </ul>
        {msg && <p className="muted petit">{msg}</p>}
      </Carte>
    </div>
  );
}
