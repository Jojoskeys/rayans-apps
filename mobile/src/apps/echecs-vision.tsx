// Rayan's Échecs Vision sur l'iPhone : l'interface de l'app Windows telle quelle, avec le magasin synchronisé
// (echecs-vision/src/storage.ts l'utilise automatiquement quand window.rayansStore existe).
import "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import "../../../echecs-vision/src/main.tsx";

mountChrome(["echecs-vision"]);
