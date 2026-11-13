import { useState } from "react";
import { searchCities } from "../core/cities.ts";
import { METHODS, PRAYERS, type AsrSchool, type HighLatRule, type MethodId, type PrayerId } from "../core/praytimes.ts";
import { NOTIFIED, type NotifiedPrayer, type Place, type Settings } from "../core/settings.ts";
import type { InitialState } from "./api-types.ts";
import { api, IconPin, save } from "./shared.tsx";

/** Recherche d'une ville, ou saisie de coordonnées. */
function ChoixLieu({ place, onPick }: { place: Place | null; onPick: (p: Place) => void }) {
  const [q, setQ] = useState("");
  const [manuel, setManuel] = useState(false);
  const [lat, setLat] = useState(place ? String(place.lat) : "");
  const [lng, setLng] = useState(place ? String(place.lng) : "");
  const [nom, setNom] = useState(place?.name ?? "");
  const results = searchCities(q);
  const sysTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const nLat = Number(lat.replace(",", ".")), nLng = Number(lng.replace(",", "."));
  const okManuel = lat.trim() !== "" && lng.trim() !== "" && Math.abs(nLat) < 90 && Math.abs(nLng) <= 180;

  return (
    <div className="choix-lieu">
      {!manuel ? (
        <>
          <input data-testid="recherche-ville" autoFocus placeholder="Rechercher une ville (Paris, Lyon, Casablanca…)" value={q} onChange={(e) => setQ(e.target.value)} />
          {results.length > 0 && (
            <ul className="resultats">
              {results.map((c) => (
                <li key={`${c.name}-${c.country}`}>
                  <button onClick={() => { onPick({ name: c.name, lat: c.lat, lng: c.lng, tz: c.tz }); setQ(""); }}>
                    <IconPin size={16} /><span>{c.name}</span><small>{c.country}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.trim() && results.length === 0 && <p className="aide">Ville absente de la liste : saisissez ses coordonnées.</p>}
          <button className="lien" onClick={() => setManuel(true)}>Saisir des coordonnées (latitude, longitude)</button>
        </>
      ) : (
        <>
          <div className="champs">
            <label className="champ">Nom du lieu<input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Chez moi" /></label>
            <span />
            <label className="champ">Latitude<input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="48.8566" /></label>
            <label className="champ">Longitude<input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="2.3522" /></label>
          </div>
          <p className="aide">Astuce : dans Google Maps, un clic droit sur un lieu affiche ses coordonnées. Fuseau horaire utilisé : {sysTz}.</p>
          <div className="actions">
            <button className="bouton" disabled={!okManuel} onClick={() => onPick({ name: nom.trim() || "Mon lieu", lat: nLat, lng: nLng, tz: sysTz })}>Utiliser ce lieu</button>
            <button className="lien" onClick={() => setManuel(false)}>Revenir à la recherche</button>
          </div>
        </>
      )}
    </div>
  );
}

/** Premier lancement : choix de la ville, de la méthode et du démarrage avec Windows. */
export function Accueil({ settings }: { settings: Settings }) {
  const [place, setPlace] = useState<Place | null>(null);
  const [method, setMethod] = useState<MethodId>(settings.method);
  const [asr, setAsr] = useState<AsrSchool>(settings.asr);
  const [startup, setStartup] = useState(true);
  return (
    <div className="accueil">
      <div className="carte">
        <div className="marque"><img src="../../assets/icon.png" alt="" width={36} height={36} /><h1>Rayan's Prière</h1></div>
        <p className="aide">Les horaires sont calculés sur votre ordinateur, sans connexion. Vous recevrez une notification avant chaque prière.</p>
        <h3>1. Votre ville</h3>
        {place ? (
          <p className="lieu-choisi"><IconPin size={16} /> <b>{place.name}</b> <button className="lien" onClick={() => setPlace(null)}>Changer</button></p>
        ) : <ChoixLieu place={null} onPick={setPlace} />}
        <h3>2. Méthode de calcul</h3>
        <div className="champs">
          <label className="champ">Angles de Fajr et Isha
            <select value={method} onChange={(e) => setMethod(e.target.value as MethodId)}>
              {METHODS.filter((m) => m.id !== "perso").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className="champ">Asr
            <select value={asr} onChange={(e) => setAsr(e.target.value as AsrSchool)}>
              <option value="shafii">Standard (chaféite, malikite, hanbalite)</option>
              <option value="hanafi">Hanafite</option>
            </select>
          </label>
        </div>
        <p className="aide">{METHODS.find((m) => m.id === method)!.detail} Vous pourrez ajuster chaque horaire de quelques minutes pour coller au calendrier de votre mosquée.</p>
        <label className="case">
          <input type="checkbox" checked={startup} onChange={(e) => setStartup(e.target.checked)} />
          <span>Démarrer avec Windows<small>Nécessaire pour recevoir les notifications sans ouvrir l'application. Modifiable dans les réglages.</small></span>
        </label>
        <button className="bouton" data-testid="commencer" disabled={!place} onClick={() => save({ place, method, asr, startWithWindows: startup })}>Commencer</button>
      </div>
    </div>
  );
}

function Nombre({ value, onChange, min, max, step = 1, unit }: { value: number; onChange: (n: number) => void; min: number; max: number; step?: number; unit?: string }) {
  return (
    <span className="avec-unite">
      <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(n); }} />
      {unit && <span>{unit}</span>}
    </span>
  );
}

export function Reglages({ s, init, notify }: { s: Settings; init: InitialState; notify: (t: string) => void }) {
  const [changerLieu, setChangerLieu] = useState(false);
  const m = METHODS.find((x) => x.id === s.method)!;
  return (
    <div className="reglages">
      <section className="carte">
        <h2>Lieu</h2>
        <p className="lieu-choisi"><IconPin size={16} /> <b>{s.place!.name}</b> <small>{s.place!.lat.toFixed(4)}, {s.place!.lng.toFixed(4)} · {s.place!.tz}</small></p>
        {changerLieu ? <ChoixLieu place={s.place} onPick={(p) => { save({ place: p }); setChangerLieu(false); }} />
          : <button className="bouton secondaire" onClick={() => setChangerLieu(true)}>Changer de lieu</button>}
      </section>

      <section className="carte">
        <h2>Calcul</h2>
        <label className="champ large">Méthode
          <select value={s.method} onChange={(e) => save({ method: e.target.value as MethodId })}>
            {METHODS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <p className="aide">{m.detail}</p>
        {s.method === "perso" && (
          <div className="champs">
            <label className="champ">Angle de Fajr<Nombre value={s.customFajr} min={5} max={25} step={0.5} unit="°" onChange={(n) => save({ customFajr: n })} /></label>
            <label className="champ">Angle d'Isha<Nombre value={s.customIsha} min={5} max={25} step={0.5} unit="°" onChange={(n) => save({ customIsha: n })} /></label>
          </div>
        )}
        <div className="champs">
          <label className="champ">Asr
            <select value={s.asr} onChange={(e) => save({ asr: e.target.value as AsrSchool })}>
              <option value="shafii">Standard (ombre × 1)</option>
              <option value="hanafi">Hanafite (ombre × 2)</option>
            </select>
          </label>
          <label className="champ">Hautes latitudes
            <select value={s.highLat} onChange={(e) => save({ highLat: e.target.value as HighLatRule })}>
              <option value="angle">Selon l'angle (recommandé)</option>
              <option value="milieu">Milieu de la nuit</option>
              <option value="septieme">Septième de la nuit</option>
              <option value="aucune">Aucune correction</option>
            </select>
          </label>
        </div>
        <p className="aide">En été, en France, le soleil ne descend pas toujours assez bas pour les angles de 18° : la correction donne alors un horaire raisonnable.</p>
      </section>

      <section className="carte">
        <h2>Ajuster sur sa mosquée</h2>
        <p className="aide">Ajoutez ou retirez des minutes à un horaire pour qu'il corresponde au calendrier affiché à votre mosquée.</p>
        <div className="decalages">
          {PRAYERS.map((p) => (
            <label key={p.id} className="champ">{p.name}
              <Nombre value={s.offsets[p.id]} min={-60} max={60} unit="min" onChange={(n) => save({ offsets: { ...s.offsets, [p.id as PrayerId]: n } })} />
            </label>
          ))}
        </div>
      </section>

      <section className="carte">
        <h2>Notifications</h2>
        <label className="champ">Rappel avant chaque prière
          <Nombre value={s.before} min={0} max={60} unit="min (0 = aucun)" onChange={(n) => save({ before: n })} />
        </label>
        <div className="cases-prieres">
          <span className="aide">Notification à l'heure :</span>
          {NOTIFIED.map((id) => (
            <label key={id} className="case">
              <input type="checkbox" checked={s.atTime[id]} onChange={(e) => save({ atTime: { ...s.atTime, [id as NotifiedPrayer]: e.target.checked } })} />
              <span>{PRAYERS.find((p) => p.id === id)!.name}</span>
            </label>
          ))}
        </div>
        <label className="champ">Avertir avant la fin de Fajr (lever du soleil)
          <Nombre value={s.sunriseWarning} min={0} max={60} unit="min (0 = non)" onChange={(n) => save({ sunriseWarning: n })} />
        </label>
        <label className="case"><input type="checkbox" checked={s.sound} onChange={(e) => save({ sound: e.target.checked })} /><span>Son de notification de Windows</span></label>
        <button className="bouton secondaire" onClick={async () => notify((await api.command({ type: "tester-notification" })) ? "Notification envoyée. Si rien n'apparaît, vérifiez les paramètres de notification de Windows (mode Ne pas déranger)." : "Les notifications ne sont pas disponibles sur ce système.")}>Envoyer une notification de test</button>
      </section>

      <section className="carte">
        <h2>Application</h2>
        <label className="case">
          <input type="checkbox" checked={s.startWithWindows} onChange={(e) => save({ startWithWindows: e.target.checked })} />
          <span>Démarrer avec Windows<small>Discrètement, dans la zone de notification.</small></span>
        </label>
        <label className="case">
          <input type="checkbox" checked={s.closeToTray} onChange={(e) => save({ closeToTray: e.target.checked })} />
          <span>Garder dans la zone de notification à la fermeture<small>Sinon, fermer la fenêtre arrête les notifications.</small></span>
        </label>
        <label className="champ">Ajustement du calendrier hégirien
          <Nombre value={s.hijriAdjust} min={-2} max={2} unit="jour(s)" onChange={(n) => save({ hijriAdjust: n })} />
        </label>
        <p className="aide">Données : <code className="chemin">{init.dataDir}</code></p>
        <div className="actions">
          <button className="lien" onClick={() => api.command({ type: "ouvrir-dossier" })}>Ouvrir le dossier</button>
          <button className="lien danger" onClick={() => api.command({ type: "quitter" })}>Quitter l'application</button>
        </div>
        <p className="version">Version {init.version}</p>
      </section>
    </div>
  );
}
