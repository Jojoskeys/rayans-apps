// Rayan's Lecture sur l'iPhone : l'interface de l'app Windows telle quelle, avec le magasin synchronisé
// (lecture/src/storage.ts l'utilise automatiquement quand window.rayansStore existe).
import "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import "../../../lecture/src/main.tsx";

mountChrome(["lecture"]);
