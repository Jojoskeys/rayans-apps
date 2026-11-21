// Rayan's Sommeil sur l'iPhone : l'interface de l'app Windows telle quelle, avec le magasin synchronisé
// (sommeil/src/storage.ts l'utilise automatiquement quand window.rayansStore existe ; il y lit aussi les réglages de Prière).
import "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import "../../../sommeil/src/main.tsx";

mountChrome(["sommeil", "priere"]);
