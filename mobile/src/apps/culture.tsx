// Rayan's Culture sur l'iPhone : l'interface de l'app Windows telle quelle, avec le magasin synchronisé
// (culture/src/storage.ts l'utilise automatiquement quand window.rayansStore existe).
import "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import "../../../culture/src/main.tsx";

mountChrome(["culture", "actu"]);
