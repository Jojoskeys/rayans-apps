// Rayan's Focus sur l'iPhone : l'interface de l'app Windows telle quelle, avec le magasin synchronisé
// (focus/src/storage.ts l'utilise automatiquement quand window.rayansStore existe).
import "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import "../../../focus/src/main.tsx";

mountChrome(["focus"]);
