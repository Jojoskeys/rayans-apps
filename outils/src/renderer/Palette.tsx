// Barre de commande : un champ, les outils qui correspondent, Entrée pour lancer, Échap pour fermer.
import { useEffect, useRef, useState } from "react";
import { suggest, toolOf } from "../core/commands.ts";
import { api, errText } from "./shared.tsx";

export function Palette() {
  const [text, setText] = useState("");
  const [sel, setSel] = useState(0);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const list = suggest(text);

  useEffect(() => {
    const reset = () => { setText(""); setSel(0); setMsg(null); setBusy(false); setTimeout(() => input.current?.focus(), 0); };
    window.addEventListener("focus", reset);
    reset();
    return () => window.removeEventListener("focus", reset);
  }, []);

  const run = async (cmd: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.run(cmd);
      if (r.ok && r.close) api.hidePalette();
      else if (r.message) setMsg({ text: r.message, ok: r.ok });
    } catch (e) { setMsg({ text: errText(e), ok: false }); }
    finally { setBusy(false); }
  };

  const submit = () => {
    const first = text.trim().split(/\s+/)[0] ?? "";
    // Mot tapé reconnu : on lance tel quel (avec ses arguments) ; sinon la suggestion sélectionnée.
    if (toolOf(first)) return run(text);
    const t = list[sel];
    if (t) return run(t.id === "img" || t.id === "eteins" ? t.id : t.command);
    setMsg({ text: "Commande inconnue.", ok: false });
  };

  return (
    <div className="palette" onKeyDown={(e) => {
      if (e.key === "Escape") api.hidePalette();
      else if (e.key === "ArrowDown") { e.preventDefault(); setSel((sel + 1) % Math.max(1, list.length)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSel((sel - 1 + list.length) % Math.max(1, list.length)); }
    }}>
      <input ref={input} data-testid="palette-champ" value={text} disabled={busy} placeholder="Tapez une commande : pdf, img 1mo, tel, wifi, son, texte, eteins 45…"
        onChange={(e) => { setText(e.target.value); setSel(0); setMsg(null); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submit(); } }} />
      {msg && <p className={`palette-message ${msg.ok ? "" : "erreur"}`}>{msg.text}</p>}
      <ul>
        {list.map((t, i) => (
          <li key={t.id}>
            <button className={i === sel ? "actif" : ""} onMouseEnter={() => setSel(i)} onClick={() => void run(t.id === "img" || t.id === "eteins" ? t.id : t.command)}>
              <code>{t.command}</code><span>{t.title}</span><small>{t.hint}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
