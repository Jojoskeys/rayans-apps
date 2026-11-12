import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { Mini } from "./Mini.tsx";

const mini = new URLSearchParams(location.search).get("vue") === "mini";
document.body.classList.toggle("vue-mini", mini);
createRoot(document.getElementById("racine")!).render(mini ? <Mini /> : <App />);
