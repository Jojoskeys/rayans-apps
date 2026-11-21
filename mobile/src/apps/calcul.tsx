// Rayan's Calcul mental sur l'iPhone : l'interface de l'app Windows telle quelle, avec le magasin synchronisé
// (calcul/src/storage.ts l'utilise automatiquement quand window.rayansStore existe).
import "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import "../../../calcul/src/main.tsx";

mountChrome(["calcul"]);
