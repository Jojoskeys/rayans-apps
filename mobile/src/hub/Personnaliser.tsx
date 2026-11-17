// Personnaliser Rayan's Mobile (sur ce téléphone) : thème, couleur, taille du texte, accueil, bouton d'accueil, icône.
import { useState } from "react";
import { APPS } from "../shared/apps.ts";
import { COULEURS, dessinerModele, enregistrerApparence, imageIcone, MODELES_ICONE, photoEnIcone, trier, type Apparence } from "../shared/apparence.ts";

export function Personnaliser({ a, onChange, onDone }: { a: Apparence; onChange: (a: Apparence) => void; onDone: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [zoom, setZoom] = useState(1);
  const maj = (p: Partial<Apparence>) => {
    const next = { ...a, ...p };
    try { enregistrerApparence(next); onChange(next); setMsg(null); } catch (e) { setMsg(String((e as Error).message)); }
  };
  const apps = trier(APPS, a);
  const deplacer = (id: string, sens: -1 | 1) => {
    const ids = apps.map((x) => x.id);
    const i = ids.indexOf(id), j = i + sens;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    maj({ ordre: ids });
  };
  const choisirPhoto = async (f: File | null, z = zoom) => {
    setPhoto(f);
    if (!f) return;
    try { maj({ icone: { modele: "photo", image: await photoEnIcone(f, z) } }); } catch (e) { setMsg(String((e as Error).message)); }
  };
  const actuelle = imageIcone(a) ?? "./icon.png";

  return (
    <section className="carte perso" data-testid="personnaliser">
      <div className="ligne entre"><h2>Personnaliser</h2><button className="lien" onClick={onDone}>Fini</button></div>
      <p>Réglages de ce téléphone (pas synchronisés avec le PC).</p>

      <h3>Apparence</h3>
      <div className="segments" role="radiogroup" aria-label="Thème">
        {(["sombre", "clair", "auto"] as const).map((t) => (
          <button key={t} role="radio" aria-checked={a.theme === t} className={a.theme === t ? "actif" : ""} onClick={() => maj({ theme: t })}>
            {t === "sombre" ? "Sombre" : t === "clair" ? "Clair" : "Comme l'iPhone"}
          </button>
        ))}
      </div>
      <p className="petit">Le thème clair s'applique à l'accueil, Aujourd'hui, Chrono et Prière ; Révision, Hifz et Ouvertures gardent le leur.</p>
      <div className="couleurs" role="radiogroup" aria-label="Couleur principale">
        {COULEURS.map((c) => (
          <button key={c.valeur} role="radio" aria-checked={a.accent === c.valeur} aria-label={c.nom} title={c.nom} className={a.accent === c.valeur ? "actif" : ""} style={{ background: c.valeur }} onClick={() => maj({ accent: c.valeur })} />
        ))}
      </div>
      <label>Taille du texte : {Math.round(a.taille * 100)} %
        <input type="range" min={0.9} max={1.25} step={0.05} value={a.taille} onChange={(e) => maj({ taille: Number(e.target.value) })} />
      </label>

      <h3>Accueil</h3>
      <label>Prénom affiché<input value={a.prenom} onChange={(e) => maj({ prenom: e.target.value })} placeholder="Rayan" /></label>
      <label className="case"><input type="checkbox" checked={a.afficherDate} onChange={(e) => maj({ afficherDate: e.target.checked })} />Afficher la date</label>
      <label className="case"><input type="checkbox" checked={a.afficherEtat} onChange={(e) => maj({ afficherEtat: e.target.checked })} />Afficher l'état de la synchro</label>
      <div className="segments" role="radiogroup" aria-label="Disposition des tuiles">
        {(["grille", "liste"] as const).map((d) => (
          <button key={d} role="radio" aria-checked={a.disposition === d} className={a.disposition === d ? "actif" : ""} onClick={() => maj({ disposition: d })}>{d === "grille" ? "Grille" : "Liste"}</button>
        ))}
      </div>
      <ul className="ordre">
        {apps.map((x, i) => {
          const visible = !a.masquees.includes(x.id);
          return (
            <li key={x.id} className={visible ? "" : "masquee"}>
              <label className="case"><input type="checkbox" checked={visible} onChange={(e) => maj({ masquees: e.target.checked ? a.masquees.filter((y) => y !== x.id) : [...a.masquees, x.id] })} />
                <span className="icone" style={{ ["--c" as string]: x.color }}>{x.icon}</span>{x.name}</label>
              <span>
                <button className="lien" aria-label={`Monter ${x.name}`} disabled={i === 0} onClick={() => deplacer(x.id, -1)}>↑</button>
                <button className="lien" aria-label={`Descendre ${x.name}`} disabled={i === apps.length - 1} onClick={() => deplacer(x.id, 1)}>↓</button>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="ligne">
        <span>Bouton ⌂ dans les apps</span>
        <div className="segments">
          {(["gauche", "droite"] as const).map((c) => <button key={c} className={a.boutonAccueil === c ? "actif" : ""} onClick={() => maj({ boutonAccueil: c })}>{c === "gauche" ? "À gauche" : "À droite"}</button>)}
        </div>
      </div>

      <h3>Icône</h3>
      <div className="icones" role="radiogroup" aria-label="Icône">
        <button role="radio" aria-checked={a.icone.modele === "origine"} className={a.icone.modele === "origine" ? "actif" : ""} onClick={() => maj({ icone: { modele: "origine" } })}>
          <img src="./icon.png" alt="" /><small>D'origine</small>
        </button>
        {MODELES_ICONE.map((m) => (
          <button key={m.id} role="radio" aria-checked={a.icone.modele === m.id} className={a.icone.modele === m.id ? "actif" : ""} onClick={() => maj({ icone: { modele: m.id, image: dessinerModele(m.id) ?? undefined } })}>
            <img src={dessinerModele(m.id) ?? ""} alt="" /><small>{m.nom}</small>
          </button>
        ))}
        <label className={`photo ${a.icone.modele === "photo" ? "actif" : ""}`}>
          {a.icone.modele === "photo" && a.icone.image ? <img src={a.icone.image} alt="" /> : <span className="plus">＋</span>}
          <small>Ma photo</small>
          <input type="file" accept="image/*" onChange={(e) => void choisirPhoto(e.target.files?.[0] ?? null)} hidden data-testid="photo-icone" />
        </label>
      </div>
      {a.icone.modele === "photo" && photo && (
        <label>Zoom sur le centre : {zoom.toFixed(1)}×
          <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => { const z = Number(e.target.value); setZoom(z); void choisirPhoto(photo, z); }} />
        </label>
      )}
      <div className="ligne apercu">
        <img src={actuelle} alt="Icône choisie" />
        <a className="bouton secondaire" href={actuelle} download="icone-rayan.png">Enregistrer l'image</a>
      </div>
      <p className="petit">
        L'iPhone ne change pas l'icône d'une app déjà sur l'écran d'accueil. Pour la nouvelle : supprime l'icône Rayan de l'écran d'accueil, puis dans Safari,
        sur cette page, Partager → « Sur l'écran d'accueil ». Si l'ancienne icône revient quand même, autre solution : app Raccourcis → nouveau raccourci
        « Ouvrir l'URL » (cette page) → Ajouter à l'écran d'accueil → touche l'icône et choisis l'image enregistrée.
      </p>
      {msg && <p className="ko">{msg}</p>}
      <button className="lien danger" onClick={() => { if (confirm("Revenir à l'apparence d'origine ?")) { localStorage.removeItem("rm-apparence"); location.reload(); } }}>Tout remettre comme au départ</button>
    </section>
  );
}
