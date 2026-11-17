// Bilan du jour : ressenti du matin (après Fajr), adhkar as-sabâh et al-masâ', liste prévue la veille au soir,
// bilan du soir (journée, ressenti, ce qu'il y a à faire demain).
import { useEffect, useState } from "react";
import { HUMEURS } from "../core/bilan.ts";
import type { BilanView } from "./api-types.ts";

const api = window.aujourdhui;
const errText = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
const hm = (ms: number | null | undefined) => (ms ? new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—");
const pad = (n: number) => String(n).padStart(2, "0");

function Humeur({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="humeurs" role="radiogroup" aria-label="Comment tu te sens">
      {HUMEURS.map((e, i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i + 1} className={value === i + 1 ? "on" : ""} onClick={() => onChange(i + 1)}>{e}</button>
      ))}
    </div>
  );
}

export function BilanToday({ b, now, notify }: { b: BilanView; now: number; notify: (t: string) => void }) {
  const j = b.aujourdhui;
  const m = b.moments;
  const [soirOuvert, setSoirOuvert] = useState(false);
  const adhkar = b.reglages.adhkar;
  const avantLever = m.finSabah === null || now < m.finSabah;
  const periodeMasa = m.debutMasa !== null && m.finMasa !== null && now >= m.debutMasa - 60 * 60_000 && now < m.finMasa + 60 * 60_000;
  const prevu = j.prevu ?? [];
  const montrerSoir = b.reglages.actif && (b.aRemplir.soir || soirOuvert);
  const apresMidi = new Date(now).getHours() * 60 + new Date(now).getMinutes() >= b.reglages.citationMidiH * 60 + b.reglages.citationMidiM;
  const citation = apresMidi ? b.citations.midi : b.citations.matin;
  return (
    <>
      {b.reglages.citations && (
        <figure className="citation" data-testid="citation">
          <blockquote>{citation.texte}</blockquote>
          {citation.auteur && <figcaption>— {citation.auteur}{citation.source && <span className="aide"> · {citation.source}</span>}</figcaption>}
        </figure>
      )}
      {(b.aRemplir.matin || (adhkar && !j.adhkar?.sabah && avantLever && now < (m.finSabah ?? 0) + 3_600_000)) && (
        <section className="carte bilan" data-testid="bilan-matin">
          <h2>🌅 Ce matin</h2>
          {adhkar && (
            <label className="case">
              <input type="checkbox" checked={!!j.adhkar?.sabah} onChange={() => api.bilan.toggleAdhkar("sabah").catch((e) => notify(errText(e)))} />
              <span>Adhkar as-sabâh<small>{b.prieres ? `Après Fajr (${hm(b.prieres.fajr)}), avant le lever du soleil (${hm(m.finSabah)}).` : "Après Fajr, avant le lever du soleil."}</small></span>
            </label>
          )}
          {b.aRemplir.matin && <FormMatin notify={notify} />}
        </section>
      )}

      {prevu.length > 0 && (
        <section className="carte" data-testid="prevu">
          <h2>📝 Prévu hier soir <span className="aide">· {prevu.filter((p) => p.fait).length}/{prevu.length}</span></h2>
          <ul className="routine-liste">
            {prevu.map((p) => (
              <li key={p.id} className={p.fait ? "fait" : ""}>
                <label className="case">
                  <input type="checkbox" checked={p.fait} onChange={() => api.bilan.togglePlanned(p.id).catch((e) => notify(errText(e)))} />
                  <span className="routine-titre">{p.texte}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {adhkar && periodeMasa && (
        <section className="carte bilan" data-testid="adhkar-soir">
          <label className="case">
            <input type="checkbox" checked={!!j.adhkar?.masa} onChange={() => api.bilan.toggleAdhkar("masa").catch((e) => notify(errText(e)))} />
            <span>🌇 Adhkar al-masâ'<small>Entre Asr ({hm(m.debutMasa)}) et Maghrib ({hm(m.finMasa)}).</small></span>
          </label>
        </section>
      )}

      {montrerSoir ? (
        <section className="carte bilan" data-testid="bilan-soir">
          <div className="titre-ligne">
            <h2>🌙 Bilan du soir</h2>
            {!b.aRemplir.soir && <button className="lien" onClick={() => setSoirOuvert(false)}>Fermer</button>}
          </div>
          <FormSoir b={b} notify={notify} onDone={() => setSoirOuvert(false)} />
        </section>
      ) : (
        b.reglages.actif && (
          <p className="aide bilan-lien">
            {j.soir ? <>🌙 Bilan du soir noté à {hm(j.soir.at)}{b.demain.length ? ` · ${b.demain.length} chose${b.demain.length > 1 ? "s" : ""} prévue${b.demain.length > 1 ? "s" : ""} pour demain` : ""}. </> : <>🌙 Bilan du soir à {pad(b.reglages.soirH)}:{pad(b.reglages.soirM)}. </>}
            <button className="lien" data-testid="ouvrir-bilan-soir" onClick={() => setSoirOuvert(true)}>{j.soir ? "Modifier" : "Le faire maintenant"}</button>
          </p>
        )
      )}
    </>
  );
}

function FormMatin({ notify }: { notify: (t: string) => void }) {
  const [humeur, setHumeur] = useState(0);
  const [texte, setTexte] = useState("");
  const enregistrer = () => api.bilan.morning(humeur, texte).then(() => notify("Noté. Bonne journée !")).catch((e) => notify(errText(e)));
  return (
    <div className="bilan-form">
      <p>Comment tu te sens aujourd'hui ?</p>
      <Humeur value={humeur} onChange={setHumeur} />
      <textarea data-testid="ressenti-matin" rows={3} placeholder="Ex. un peu fatigué, mais motivé pour le TD de cet après-midi…" value={texte} onChange={(e) => setTexte(e.target.value)} />
      <button className="bouton" data-testid="enregistrer-matin" disabled={!humeur} onClick={enregistrer}>Enregistrer</button>
    </div>
  );
}

function FormSoir({ b, notify, onDone }: { b: BilanView; notify: (t: string) => void; onDone: () => void }) {
  const s = b.aujourdhui.soir;
  const [humeur, setHumeur] = useState(s?.humeur ?? 0);
  const [journee, setJournee] = useState(s?.journee ?? "");
  const [ressenti, setRessenti] = useState(s?.ressenti ?? "");
  const [demain, setDemain] = useState<string[]>(b.demain.length ? b.demain.map((p) => p.texte) : [""]);
  useEffect(() => { if (demain[demain.length - 1]?.trim()) setDemain([...demain, ""]); }, [demain]);
  const enregistrer = () =>
    api.bilan.evening(humeur, journee, ressenti, demain).then(() => { notify("Bilan enregistré. Bonne soirée !"); onDone(); }).catch((e) => notify(errText(e)));
  return (
    <div className="bilan-form">
      <p>Comment s'est passée ta journée ?</p>
      <textarea data-testid="journee-soir" rows={3} placeholder="Ce qui s'est bien passé, ce qui a été difficile…" value={journee} onChange={(e) => setJournee(e.target.value)} />
      <p>Comment tu te sens ?</p>
      <Humeur value={humeur} onChange={setHumeur} />
      <textarea data-testid="ressenti-soir" rows={2} placeholder="En quelques mots" value={ressenti} onChange={(e) => setRessenti(e.target.value)} />
      <p>Pour demain : objectifs, choses à faire</p>
      <div className="demain">
        {demain.map((t, i) => (
          <input key={i} data-testid="demain" placeholder={i === 0 ? "Ex. réviser le chapitre 3" : "Autre chose…"} value={t} onChange={(e) => setDemain(demain.map((x, k) => (k === i ? e.target.value : x)))} />
        ))}
      </div>
      <button className="bouton" data-testid="enregistrer-soir" disabled={!humeur} onClick={enregistrer}>Enregistrer le bilan</button>
      <p className="aide">Demain, cette liste apparaîtra à cocher, et dans le rappel du matin.</p>
    </div>
  );
}

export function BilanReglages({ b, notify }: { b: BilanView; notify: (t: string) => void }) {
  const r = b.reglages;
  const set = (p: Parameters<typeof api.bilan.settings>[0]) => api.bilan.settings(p).catch((e) => notify(errText(e)));
  return (
    <div className="carte">
      <h2>Bilan et adhkar</h2>
      <label className="case"><input type="checkbox" checked={r.actif} onChange={(e) => set({ actif: e.target.checked })} />
        <span>Bilan du matin et du soir<small>Le matin : comment tu te sens. Le soir : ta journée, ton ressenti, et ce que tu veux faire demain.</small></span></label>
      <label className="champ-ligne">Bilan du soir à
        <input type="time" value={`${pad(r.soirH)}:${pad(r.soirM)}`} disabled={!r.actif}
          onChange={(e) => { const [h, m] = e.target.value.split(":").map(Number); if (Number.isInteger(h) && Number.isInteger(m)) void set({ soirH: h, soirM: m }); }} />
      </label>
      <label className="case"><input type="checkbox" checked={r.adhkar} onChange={(e) => set({ adhkar: e.target.checked })} />
        <span>Adhkar as-sabâh et al-masâ'<small>Rappel après Fajr (Sobh), et entre Asr et Maghrib avec un dernier rappel 10 min avant Maghrib s'ils ne sont pas cochés.</small></span></label>
      <label className="case"><input type="checkbox" checked={r.citations} onChange={(e) => set({ citations: e.target.checked })} />
        <span>Citation du jour<small>Hadiths du Prophète ﷺ (avec leur référence), savants et philosophes, et phrases pour bien démarrer : une le matin, une à midi.</small></span></label>
      <label className="champ-ligne">Citations à
        <input type="time" value={`${pad(r.citationMatinH)}:${pad(r.citationMatinM)}`} disabled={!r.citations}
          onChange={(e) => { const [h, m] = e.target.value.split(":").map(Number); if (Number.isInteger(h) && Number.isInteger(m)) void set({ citationMatinH: h, citationMatinM: m }); }} />
        et
        <input type="time" value={`${pad(r.citationMidiH)}:${pad(r.citationMidiM)}`} disabled={!r.citations}
          onChange={(e) => { const [h, m] = e.target.value.split(":").map(Number); if (Number.isInteger(h) && Number.isInteger(m)) void set({ citationMidiH: h, citationMidiM: m }); }} />
      </label>
      <label className="champ-ligne">Rappel du matin
        <input type="number" min={0} max={90} value={r.apresFajr} onChange={(e) => set({ apresFajr: Number(e.target.value) })} /> min après Fajr
      </label>
      <label className="champ-ligne">Adhkar du soir
        <input type="number" min={5} max={180} value={r.avantMaghrib} onChange={(e) => set({ avantMaghrib: Number(e.target.value) })} /> min avant Maghrib
      </label>
      <p className="aide">
        {b.prieres
          ? <>Aujourd'hui (heures de Rayan's Prière) : Fajr {hm(b.prieres.fajr)} → rappel à {hm(b.moments.matin)} · Asr {hm(b.prieres.asr)} · adhkar du soir à {hm(b.moments.masa)} · Maghrib {hm(b.prieres.maghrib)}.</>
          : <>Heures de prière inconnues (choisis ta ville dans Rayan's Prière) : rappel du matin à {pad(r.matinSecoursH)}:00, pas de rappel des adhkar du soir.</>}
      </p>
      {b.historique.length > 0 && (
        <details>
          <summary className="lien">Mes bilans ({b.historique.length} derniers jours)</summary>
          <ul className="historique-bilan">
            {b.historique.map((h) => (
              <li key={h.jour}>
                <b>{new Date(h.jour + "T12:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</b>
                {h.matin && <span> · matin {HUMEURS[h.matin.humeur - 1]} {h.matin.ressenti}</span>}
                {h.soir && <span> · soir {HUMEURS[h.soir.humeur - 1]} {h.soir.journee} {h.soir.ressenti && `(${h.soir.ressenti})`}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
