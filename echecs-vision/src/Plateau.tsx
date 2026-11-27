// L'échiquier (chessground, le même que dans Rayan's Ouvertures et sur lichess), enveloppé pour React.
import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import type { Config } from "chessground/config";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import { useEffect, useRef } from "react";

/** chessground n'écoute les clics que s'il est créé en mode interactif : on le recrée quand `viewOnly` change. */
export function Plateau({ config, petit }: { config: Config; petit?: boolean }) {
  return <PlateauCg key={config.viewOnly ? "vue" : "jeu"} config={config} petit={petit} />;
}

function PlateauCg({ config, petit }: { config: Config; petit?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  useEffect(() => {
    if (!el.current) return;
    const cg = Chessground(el.current, { animation: { enabled: true, duration: 150 }, premovable: { enabled: false }, ...config });
    api.current = cg;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => cg.redrawAll()) : null;
    ro?.observe(el.current);
    return () => { ro?.disconnect(); cg.destroy(); api.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { api.current?.set(config); }, [config]);
  return <div className={`plateau ${petit ? "petit" : ""}`}><div ref={el} className="cg-wrap-hote" /></div>;
}
