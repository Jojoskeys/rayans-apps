import { useEffect, useState } from "react";
import { formatDuration, formatSize, parseDuration, parseSize, type PowerMode } from "../core/commands.ts";
import type { Goto, Output, PdfQuality, State, WifiInfo } from "./api-types.ts";
import { api, basename, DropZone, errText, IconCheck, IconClose, IconCopy, IconDown, IconEye, IconUp } from "./shared.tsx";

type Props = { s: State; goto: Goto | null; notify: (t: string) => void };

function Resultat({ children, ok = true }: { children: React.ReactNode; ok?: boolean }) {
  return <div className={`resultat ${ok ? "" : "attention"}`}>{children}</div>;
}

// ----- PDF ----------------------------------------------------------------------------------------

export function OutilPdf({ s, notify }: Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [quality, setQuality] = useState<PdfQuality>(s.settings.pdfQuality);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ out: string; pages: number; bytes: number } | null>(null);
  const add = (p: string[]) => { setFiles((f) => [...f, ...p.filter((x) => !f.includes(x))]); setDone(null); };
  const move = (i: number, d: number) => setFiles((f) => { const c = [...f]; [c[i], c[i + d]] = [c[i + d], c[i]]; return c; });

  return (
    <section className="outil">
      <header><h1>Fusionner en PDF</h1><p className="aide">Photos de documents, scans et PDF, dans l'ordre de la liste, en un seul PDF. Les photos sont allégées et mises au format A4.</p></header>
      <DropZone label="Déposez des photos (JPEG, PNG) ou des PDF" accept={["jpg", "jpeg", "png", "bmp", "pdf"]} onFiles={add} onPick={async () => add(await api.pickFiles("pdf", true))} />
      {files.length > 0 && (
        <ol className="liste-fichiers" data-testid="fichiers-pdf">
          {files.map((f, i) => (
            <li key={f}>
              <span className="numero">{i + 1}</span>
              <span className="nom" title={f}>{basename(f)}</span>
              <button className="icone" disabled={i === 0} onClick={() => move(i, -1)} title="Monter"><IconUp size={16} /></button>
              <button className="icone" disabled={i === files.length - 1} onClick={() => move(i, 1)} title="Descendre"><IconDown size={16} /></button>
              <button className="icone" onClick={() => setFiles(files.filter((x) => x !== f))} title="Retirer"><IconClose size={16} /></button>
            </li>
          ))}
        </ol>
      )}
      <div className="barre">
        <label className="champ-ligne">Qualité des photos
          <select value={quality} onChange={(e) => setQuality(e.target.value as PdfQuality)}>
            <option value="legere">Légère (pour envoyer par e-mail ou formulaire)</option>
            <option value="normale">Normale</option>
            <option value="originale">Originale (fichier plus lourd)</option>
          </select>
        </label>
        <button className="bouton" disabled={!files.length || busy} onClick={async () => {
          setBusy(true);
          try { const r = await api.mergePdf(files, quality); if (r) setDone(r); }
          catch (e) { notify(errText(e)); }
          finally { setBusy(false); }
        }}>{busy ? "Création…" : "Créer le PDF"}</button>
        {files.length > 0 && <button className="lien" onClick={() => { setFiles([]); setDone(null); }}>Vider la liste</button>}
      </div>
      {done && (
        <Resultat>
          <IconCheck /> <b>{basename(done.out)}</b> · {done.pages} page{done.pages > 1 ? "s" : ""} · {formatSize(done.bytes)}
          <span className="actions"><button className="lien" onClick={() => api.openPath(done.out)}>Ouvrir</button><button className="lien" onClick={() => api.showInFolder(done.out)}>Afficher dans le dossier</button></span>
        </Resultat>
      )}
    </section>
  );
}

// ----- Image --------------------------------------------------------------------------------------

const koLabel = (ko: number) => (ko >= 1024 ? `${String(+(ko / 1024).toFixed(1)).replace(".", ",")} Mo` : `${ko} Ko`);

export function OutilImage({ s, goto, notify }: Props) {
  const [target, setTarget] = useState(koLabel(goto?.targetKo || s.settings.imgTarget));
  useEffect(() => { if (goto?.tool === "img" && goto.targetKo) setTarget(koLabel(goto.targetKo)); }, [goto]);
  const [results, setResults] = useState<{ file: string; out?: string; bytes?: number; before?: number; width?: number; height?: number; ok?: boolean; error?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const ko = parseSize(target);

  const run = async (paths: string[]) => {
    if (!ko) { notify("Taille cible invalide : par exemple 500 Ko ou 1 Mo."); return; }
    setBusy(true);
    const out: typeof results = [];
    for (const f of paths) {
      try { out.push({ file: f, ...(await api.compressImage(f, ko)) }); }
      catch (e) { out.push({ file: f, error: errText(e) }); }
      setResults([...out]);
    }
    setBusy(false);
  };

  return (
    <section className="outil">
      <header><h1>Alléger une image</h1><p className="aide">Pour les formulaires qui refusent les fichiers trop lourds. Une copie JPEG est créée à côté de l'original, qui n'est pas modifié.</p></header>
      <div className="barre">
        <label className="champ-ligne">Taille maximale
          <input data-testid="cible" value={target} onChange={(e) => setTarget(e.target.value)} style={{ width: 110 }} />
        </label>
        {["200 Ko", "500 Ko", "1 Mo", "2 Mo"].map((t) => <button key={t} className={`puce ${target === t ? "active" : ""}`} onClick={() => setTarget(t)}>{t}</button>)}
        {!ko && <span className="erreur">Taille invalide</span>}
      </div>
      <DropZone label={busy ? "Compression…" : "Déposez une ou plusieurs images (JPEG, PNG)"} accept={["jpg", "jpeg", "png", "bmp"]} onFiles={run} onPick={async () => run(await api.pickFiles("image", true))} />
      {results.map((r) => r.error ? <Resultat key={r.file} ok={false}>{basename(r.file)} : {r.error}</Resultat> : (
        <Resultat key={r.file} ok={r.ok}>
          {r.ok ? <IconCheck /> : null} <b>{basename(r.out!)}</b> · {formatSize(r.before!)} → <b>{formatSize(r.bytes!)}</b> · {r.width} × {r.height} px
          {!r.ok && <span> · impossible de descendre sous la cible sans rendre l'image illisible</span>}
          <span className="actions"><button className="lien" onClick={() => api.showInFolder(r.out!)}>Afficher dans le dossier</button></span>
        </Resultat>
      ))}
    </section>
  );
}

// ----- Téléphone ----------------------------------------------------------------------------------

export function OutilTel({ s, goto, notify }: Props) {
  const [text, setText] = useState(goto?.tool === "tel" && goto.text ? goto.text : "");
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => { if (goto?.tool === "tel" && goto.text) setText(goto.text); }, [goto]);
  useEffect(() => {
    let alive = true;
    if (!text.trim()) { setQr(null); return; }
    const id = setTimeout(() => api.qr(text.trim()).then((q) => { if (alive) setQr(q); }), 150);
    return () => { alive = false; clearTimeout(id); };
  }, [text]);
  const sh = s.share;
  const start = async (files: string[]) => { try { await api.shareStart(files); } catch (e) { notify(errText(e)); } };

  return (
    <section className="outil">
      <header><h1>Échanger avec le téléphone</h1><p className="aide">Scannez le QR code avec l'appareil photo du téléphone. Le téléphone doit être sur le même Wi-Fi que l'ordinateur.</p></header>
      <div className="deux-colonnes">
        <div className="carte">
          <h2>Fichiers</h2>
          {sh ? (
            <div className="partage" data-testid="partage">
              <img src={sh.qr} alt="QR code du partage" width={220} height={220} />
              <div>
                <p><b>Partage ouvert</b> jusqu'à {new Date(sh.expiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.</p>
                {sh.files.length > 0 && <p className="aide">À télécharger : {sh.files.map((f) => f.name).join(", ")}</p>}
                <p className="aide">Le téléphone peut aussi envoyer ses photos : elles arrivent dans <button className="lien" onClick={() => api.openPath(sh.inbox)}>Téléchargements\Depuis le téléphone</button>.</p>
                {sh.received.length > 0 && <ul className="recus">{sh.received.map((r) => <li key={r}><button className="lien" onClick={() => api.showInFolder(r)}>{basename(r)}</button></li>)}</ul>}
                <p className="aide petit"><code>{sh.url}</code></p>
                <button className="bouton secondaire" onClick={() => api.shareStop()}>Arrêter le partage</button>
              </div>
            </div>
          ) : (
            <>
              <DropZone label="Déposez les fichiers à envoyer au téléphone" accept={["*"]} onFiles={start} onPick={async () => { const f = await api.pickFiles("tout", true); if (f.length) await start(f); }} />
              <button className="bouton secondaire" onClick={() => start([])}>Recevoir des photos du téléphone</button>
              <p className="aide">La première fois, Windows peut demander d'autoriser l'accès au réseau privé : acceptez. Le partage se ferme seul après 15 minutes.</p>
            </>
          )}
        </div>
        <div className="carte">
          <h2>Lien ou texte</h2>
          <textarea data-testid="texte-qr" rows={3} placeholder="Collez un lien, une adresse, un numéro…" value={text} onChange={(e) => setText(e.target.value)} />
          {qr ? <img className="qr" data-testid="qr-texte" src={qr} alt="QR code du texte" width={220} height={220} /> : <p className="aide">Le QR code apparaît ici. Le téléphone l'ouvre directement, sans réseau.</p>}
        </div>
      </div>
    </section>
  );
}

// ----- Wi-Fi --------------------------------------------------------------------------------------

export function OutilWifi({ notify }: Props) {
  const [w, setW] = useState<WifiInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const load = () => { setErr(null); api.wifi().then(setW, (e) => setErr(errText(e))); };
  useEffect(load, []);
  return (
    <section className="outil">
      <header><h1>Mot de passe Wi-Fi</h1><p className="aide">Le réseau auquel l'ordinateur est connecté, avec sa clé enregistrée par Windows.</p></header>
      {err && <Resultat ok={false}>{err}</Resultat>}
      {!w && !err && <p className="aide">Lecture…</p>}
      {w && !w.connecte && <Resultat ok={false}>L'ordinateur n'est connecté à aucun Wi-Fi (câble Ethernet ?). <button className="lien" onClick={load}>Réessayer</button></Resultat>}
      {w?.connecte && (
        <div className="carte wifi">
          {w.qr && <img src={w.qr} alt="QR code de connexion" width={220} height={220} />}
          <dl>
            <dt>Réseau</dt><dd><b>{w.ssid}</b></dd>
            <dt>Mot de passe</dt>
            <dd className="cle">
              {w.cle ? <><code>{show ? w.cle : "•".repeat(Math.min(w.cle.length, 16))}</code>
                <button className="icone" onClick={() => setShow(!show)} title={show ? "Masquer" : "Afficher"}><IconEye size={18} /></button>
                <button className="icone" onClick={() => { api.copy(w.cle!); notify("Mot de passe copié."); }} title="Copier"><IconCopy size={18} /></button></> : "réseau ouvert"}
            </dd>
            <dt>Sécurité</dt><dd>{w.securite}</dd>
          </dl>
          <p className="aide">Un invité scanne le QR code avec l'appareil photo de son téléphone pour se connecter sans taper le mot de passe.</p>
        </div>
      )}
    </section>
  );
}

// ----- Son ----------------------------------------------------------------------------------------

export function OutilSon({ goto, notify }: Props) {
  const [outs, setOuts] = useState<Output[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.outputs().then(setOuts, (e) => setErr(errText(e))); }, []);
  return (
    <section className="outil">
      <header><h1>Sortie audio</h1><p className="aide">Cliquez sur une sortie pour l'utiliser. Plus rapide : tapez <code>son</code> dans la barre de commande pour passer à la suivante, ou <code>son casque</code>.</p></header>
      {goto?.tool === "son" && goto.message && <Resultat ok={false}>{goto.message}</Resultat>}
      {err && <Resultat ok={false}>{err}</Resultat>}
      {outs && (
        <ul className="sorties">
          {outs.map((o) => (
            <li key={o.id}>
              <button className={o.parDefaut ? "active" : ""} onClick={async () => {
                try { setOuts(await api.setOutput(o.id)); notify(`Sortie audio : ${o.nom}`); } catch (e) { notify(errText(e)); }
              }}>
                <span>{o.nom}</span>{o.parDefaut && <small>utilisée</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ----- Texte de l'écran ---------------------------------------------------------------------------

export function OutilTexte({ s, notify }: Props) {
  const t = s.lastText;
  return (
    <section className="outil">
      <header><h1>Copier le texte de l'écran</h1><p className="aide">Sélectionnez une zone de l'écran (image, PDF scanné, vidéo, capture) : le texte est reconnu par Windows et copié. Échap pour annuler.</p></header>
      <div className="barre"><button className="bouton" onClick={() => api.captureText().catch((e) => notify(errText(e)))}>Sélectionner une zone</button><span className="aide">ou tapez <code>texte</code> dans la barre de commande</span></div>
      {t && (t.texte ? (
        <div className="carte">
          <div className="entete"><h2>Dernier texte copié</h2><button className="lien" onClick={() => { api.copy(t.texte); notify("Texte copié."); }}><IconCopy size={16} /> Copier à nouveau</button></div>
          <pre className="texte-ocr">{t.texte}</pre>
        </div>
      ) : <Resultat ok={false}>Aucun texte reconnu dans la dernière sélection. Essayez une zone plus grande ou un texte plus net.</Resultat>)}
    </section>
  );
}

// ----- Éteindre plus tard -------------------------------------------------------------------------

const MODES: { id: PowerMode; label: string }[] = [{ id: "eteindre", label: "Éteindre" }, { id: "veille", label: "Mettre en veille" }, { id: "redemarrer", label: "Redémarrer" }];

export function OutilEteins({ s, notify }: Props) {
  const [mode, setMode] = useState<PowerMode>("eteindre");
  const [dur, setDur] = useState("45");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const min = parseDuration(dur);
  const p = s.power;
  return (
    <section className="outil">
      <header><h1>Éteindre plus tard</h1><p className="aide">Pour une vidéo ou un téléchargement le soir. Dans la barre de commande : <code>eteins 45</code>, <code>veille 20</code>, <code>eteins 1h30</code>, <code>eteins annuler</code>.</p></header>
      {p && (
        <div className="carte minuterie" data-testid="minuterie">
          <div>
            <span className="etiquette">{MODES.find((m) => m.id === p.mode)!.label} à {new Date(p.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
            <div className="decompte">{formatDuration(Math.max(0, Math.ceil((p.at - now) / 60_000)))}</div>
          </div>
          <button className="bouton danger" onClick={() => api.cancelPower()}>Annuler</button>
        </div>
      )}
      <div className="carte pile">
        <div className="segmente">{MODES.map((m) => <button key={m.id} className={mode === m.id ? "actif" : ""} onClick={() => setMode(m.id)}>{m.label}</button>)}</div>
        <div className="barre">
          <label className="champ-ligne">Dans <input value={dur} onChange={(e) => setDur(e.target.value)} style={{ width: 90 }} /></label>
          {["15", "30", "45", "1h", "1h30", "2h"].map((d) => <button key={d} className={`puce ${dur === d ? "active" : ""}`} onClick={() => setDur(d)}>{d.includes("h") ? d : `${d} min`}</button>)}
        </div>
        <button className="bouton" disabled={!min} onClick={async () => {
          try { await api.schedulePower(mode, min!); notify(`${MODES.find((m) => m.id === mode)!.label} dans ${formatDuration(min!)}.`); } catch (e) { notify(errText(e)); }
        }}>{min ? `${MODES.find((m) => m.id === mode)!.label} dans ${formatDuration(min)}` : "Durée invalide (ex. 45, 1h30)"}</button>
        <p className="aide">L'extinction et le redémarrage sont confiés à Windows : ils ont lieu même si vous fermez Rayan's Outils. La veille, elle, demande que l'application reste ouverte.</p>
      </div>
    </section>
  );
}
