// Habillage commun des apps sur l'iPhone : bouton de retour à l'accueil (en mode « écran d'accueil » il n'y a pas
// de barre du navigateur), pastille d'état de la synchro, envoi automatique en arrière-plan.
import { installAutoSync, onStatus } from "./sync.ts";
import { appliquerApparence, lireApparence, noterApp } from "./apparence.ts";

export function mountChrome(files: string[]) {
  installAutoSync(files);
  const css = document.createElement("style");
  css.textContent = `
    #rm-accueil { position: fixed; z-index: 2147483000; left: max(10px, env(safe-area-inset-left)); bottom: calc(env(safe-area-inset-bottom) + 10px);
      width: 44px; height: 44px; border-radius: 99px; border: 1px solid #2B313B; background: rgba(24,28,34,.92); color: #ECEFF3;
      font: 20px/1 system-ui; display: grid; place-items: center; text-decoration: none; box-shadow: 0 6px 18px rgba(0,0,0,.35); }
    #rm-accueil i { position: absolute; top: 3px; right: 3px; width: 9px; height: 9px; border-radius: 99px; background: #6B7484; }
    #rm-accueil i.a-jour { background: #3BA776; } #rm-accueil i.erreur { background: #E8594F; } #rm-accueil i.en-cours { background: #E3A33B; }
    html { -webkit-text-size-adjust: 100%; }
    body { padding-bottom: calc(env(safe-area-inset-bottom) + 64px); }`;
  const app = lireApparence();
  if (app.boutonAccueil === "droite") css.textContent += `
#rm-accueil { left: auto; right: max(10px, env(safe-area-inset-right)); }`;
  document.head.append(css);
  // Thème, couleur, taille du texte et icône choisis dans « Personnaliser » (après les styles de l'app).
  const appliquer = () => appliquerApparence(app);
  appliquer();
  addEventListener("load", appliquer);
  addEventListener("storage", (e) => { if (e.key === "rm-apparence") location.reload(); });
  const a = document.createElement("a");
  a.id = "rm-accueil";
  // « ?accueil » : revenir à l'accueil même si une app s'ouvre au démarrage.
  a.href = "../?accueil";
  const id = location.pathname.split("/").filter(Boolean).at(-1);
  if (id) noterApp(id);
  a.setAttribute("aria-label", "Accueil");
  a.textContent = "⌂";
  const dot = document.createElement("i");
  a.append(dot);
  const add = () => document.body.append(a);
  if (document.body) add(); else addEventListener("DOMContentLoaded", add);
  onStatus((s) => { dot.className = s.configured ? s.state : ""; a.title = s.message; });
  // Les apps Windows pointent leur logo vers ../../assets/icon.png (dossier de l'app) : ici, l'icône commune.
  const fixIcons = () => { for (const img of document.querySelectorAll<HTMLImageElement>('img[src$="assets/icon.png"]')) img.src = "../icon.png"; };
  new MutationObserver(fixIcons).observe(document.documentElement, { childList: true, subtree: true });
}
