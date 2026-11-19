import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { Mini } from "./Mini.tsx";
import { BarreTemps, EcranPause } from "./Focus.tsx";

const vue = new URLSearchParams(location.search).get("vue");
document.body.classList.toggle("vue-mini", vue === "mini");
document.body.classList.toggle("vue-barre", vue === "barre");
createRoot(document.getElementById("racine")!).render(vue === "mini" ? <Mini /> : vue === "pause" ? <EcranPause /> : vue === "barre" ? <BarreTemps /> : <App />);
