// Rayan's Calme sur l'iPhone : l'interface de l'app Windows telle quelle, avec le magasin synchronisé
// (calme/src/storage.ts l'utilise automatiquement quand window.rayansStore existe).
import "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import "../../../calme/src/main.tsx";

mountChrome(["calme"]);
