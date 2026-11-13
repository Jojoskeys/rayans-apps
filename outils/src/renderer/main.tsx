import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { Capture } from "./Capture.tsx";
import { Palette } from "./Palette.tsx";

const vue = new URLSearchParams(location.search).get("vue");
document.body.classList.add(`vue-${vue ?? "principale"}`);
createRoot(document.getElementById("racine")!).render(vue === "palette" ? <Palette /> : vue === "capture" ? <Capture /> : <App />);
