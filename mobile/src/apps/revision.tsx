// Rayan's Révision sur l'iPhone : l'interface de l'app Windows telle quelle, avec le magasin synchronisé
// (revision/src/storage.ts l'utilise automatiquement quand window.rayansStore existe).
import "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import "../../../revision/src/main.tsx";

mountChrome(["revision"]);
