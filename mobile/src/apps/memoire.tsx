// Rayan's Mémoire sur l'iPhone : l'interface de l'app Windows telle quelle, avec le magasin synchronisé
// (memoire/src/storage.ts l'utilise automatiquement quand window.rayansStore existe).
import "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import "../../../memoire/src/main.tsx";

mountChrome(["memoire"]);
