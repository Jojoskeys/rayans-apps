import { useEffect, useMemo, useState } from "react";
import { PRAYERS, qibla, type PrayerId } from "../core/praytimes.ts";
import { currentPrayer, dayAt, days, nextPrayer, prayerName } from "../core/schedule.ts";
import { NOTIFIED, type NotifiedPrayer, type Settings } from "../core/settings.ts";
import { Accueil, Reglages } from "./Reglages.tsx";
import { countdown, gregorian, hijri, hm, IconBell, IconBellOff, IconCalendar, IconClose, IconGear, IconLeft, IconRight, IconSun, save, usePriere } from "./shared.tsx";

type Onglet = "jour" | "mois" | "reglages";
const ONGLETS: { id: Onglet; label: string; icon: () => React.ReactElement }[] = [
  { id: "jour", label: "Aujourd'hui", icon: () => <IconSun /> },
  { id: "mois", label: "Calendrier", icon: () => <IconCalendar /> },
  { id: "reglages", label: "Réglages", icon: () => <IconGear /> },
];

export function App() {
  const { init, data, now } = usePriere();
  const [onglet, setOnglet] = useState<Onglet>("jour");
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (init?.warning) setToast(init.warning); }, [init]);

  const s = data?.settings;
  const next = s ? nextPrayer(s, now) : null;
  useEffect(() => {
    const title = s?.place && next ? `${prayerName(next.id, next.date)} ${hm(next.at, s.place.tz)} — Rayan's Prière` : "Rayan's Prière";
    if (document.title !== title) document.title = title;
  }, [s, next]);

  if (!data || !init || !s) return <div className="chargement">Chargement…</div>;
  if (!s.place) return <Accueil settings={s} />;

  return (
    <div className="app">
      <nav className="navigation-principale">
        <div className="marque"><img src="../../assets/icon.png" alt="" width={28} height={28} /><span>Rayan's Prière</span></div>
        {ONGLETS.map((o) => (
          <button key={o.id} className={onglet === o.id ? "actif" : ""} onClick={() => setOnglet(o.id)} aria-current={onglet === o.id ? "page" : undefined}>
            {o.icon()}<span>{o.label}</span>
          </button>
        ))}
      </nav>
      <main className="contenu">
        {onglet === "jour" && <Jour s={s} now={now} />}
        {onglet === "mois" && <Mois s={s} now={now} />}
        {onglet === "reglages" && <Reglages s={s} init={init} notify={setToast} />}
      </main>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button className="icone" onClick={() => setToast(null)} title="Fermer"><IconClose size={16} /></button>
        </div>
      )}
    </div>
  );
}

function Jour({ s, now }: { s: Settings; now: number }) {
  const tz = s.place!.tz;
  const v = dayAt(s, now)!;
  const next = nextPrayer(s, now);
  const cur = currentPrayer(s, now);
  const q = qibla(s.place!.lat, s.place!.lng);
  const paused = s.pausedUntil && now < s.pausedUntil;

  return (
    <div className="jour">
      <header className="entete-jour">
        <div>
          <h1 data-testid="lieu">{s.place!.name}</h1>
          <p className="dates">{gregorian(now, tz)} · <span data-testid="hijri">{hijri(now, tz, s.hijriAdjust)}</span></p>
        </div>
        <p className="hijri-ar" lang="ar" dir="rtl">{hijri(now, tz, s.hijriAdjust, "ar")}</p>
      </header>

      {next && (
        <section className="carte prochaine">
          <span className="etiquette">Prochaine prière</span>
          <div className="prochaine-ligne">
            <strong data-testid="prochaine">{prayerName(next.id, next.date)}</strong>
            <span className="a">à {hm(next.at, tz)}</span>
          </div>
          <div className="decompte" data-testid="decompte">{countdown(next.at - now)}</div>
          {paused && <p className="aide">Notifications suspendues jusqu'à {hm(s.pausedUntil!, tz)}. <button className="lien" onClick={() => save({ pausedUntil: null })}>Reprendre</button></p>}
        </section>
      )}

      <ul className="horaires carte" data-testid="horaires">
        {PRAYERS.map((p) => {
          const at = v.times[p.id];
          const passe = Number.isFinite(at) && at <= now && cur !== p.id;
          const notif = p.isPrayer ? s.atTime[p.id as NotifiedPrayer] : null;
          return (
            <li key={p.id} className={`${cur === p.id ? "en-cours" : ""} ${passe ? "passe" : ""} ${p.isPrayer ? "" : "secondaire"}`} data-priere={p.id}>
              <span className="nom">{prayerName(p.id, v.date)}{cur === p.id && <small> en cours</small>}</span>
              <span className="arabe" lang="ar">{p.arabic}</span>
              <span className="heure">{hm(at, tz)}</span>
              {notif === null ? <span className="icone" /> : (
                <button className="icone" title={notif ? "Notification activée : cliquer pour la couper" : "Notification coupée : cliquer pour l'activer"}
                  onClick={() => save({ atTime: { ...s.atTime, [p.id]: !notif } })} aria-pressed={notif}>
                  {notif ? <IconBell size={18} /> : <IconBellOff size={18} />}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <section className="infos">
        <div className="carte qibla">
          <div className="boussole" aria-hidden="true"><span style={{ transform: `rotate(${q}deg)` }} /></div>
          <div><strong>Qibla : {Math.round(q)}°</strong><p className="aide">depuis le nord, dans le sens des aiguilles d'une montre ({direction(q)}).</p></div>
        </div>
        <div className="carte">
          <strong>Rappels</strong>
          <p className="aide">
            {s.before > 0 ? `${s.before} min avant chaque prière` : "Pas de rappel avant"}
            {NOTIFIED.some((id) => s.atTime[id]) ? ", et à l'heure." : "."}
            {" "}L'application doit rester ouverte dans la zone de notification.
          </p>
        </div>
      </section>
    </div>
  );
}

function direction(a: number) {
  const n = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"];
  return n[Math.round(a / 45) % 8];
}

function Mois({ s, now }: { s: Settings; now: number }) {
  const tz = s.place!.tz;
  const [shift, setShift] = useState(0);
  const { title, rows, today } = useMemo(() => {
    const [y, m] = dayAt(s, now)!.date;
    const first = new Date(Date.UTC(y, m - 1 + shift, 1));
    const fy = first.getUTCFullYear(), fm = first.getUTCMonth() + 1;
    const count = new Date(Date.UTC(fy, fm, 0)).getUTCDate();
    const probe = Date.UTC(fy, fm - 1, 1, 12);
    const rows = days(s, probe, count);
    const t = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", month: "long", year: "numeric" }).format(first);
    return { title: t.charAt(0).toUpperCase() + t.slice(1), rows, today: dayAt(s, now)!.date.join("-") };
  }, [s, now, shift]);
  const ids: PrayerId[] = ["fajr", "lever", "dhuhr", "asr", "maghrib", "isha"];

  return (
    <div className="mois">
      <div className="barre-outils">
        <div className="navigation">
          <button className="icone" onClick={() => setShift(shift - 1)} title="Mois précédent"><IconLeft /></button>
          <h2 data-testid="titre-mois">{title}</h2>
          <button className="icone" onClick={() => setShift(shift + 1)} title="Mois suivant"><IconRight /></button>
        </div>
        {shift !== 0 && <button className="bouton secondaire" onClick={() => setShift(0)}>Ce mois-ci</button>}
        <span className="aide">{s.place!.name}</span>
      </div>
      <table className="tableau carte">
        <thead><tr><th>Jour</th>{ids.map((id) => <th key={id}>{PRAYERS.find((p) => p.id === id)!.name.replace("Lever du soleil", "Lever")}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => {
            const ms = Date.UTC(r.date[0], r.date[1] - 1, r.date[2], 12);
            const wd = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric" }).format(new Date(ms));
            const friday = new Date(ms).getUTCDay() === 5;
            return (
              <tr key={r.date.join("-")} className={`${r.date.join("-") === today ? "aujourdhui" : ""} ${friday ? "vendredi" : ""}`}>
                <td>{wd}</td>
                {ids.map((id) => <td key={id} className={id === "lever" ? "secondaire" : ""}>{hm(r.times[id], tz)}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
