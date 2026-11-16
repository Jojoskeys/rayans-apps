import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

createRoot(document.getElementById("racine")!).render(<App />);

// Un fichier déposé hors de la zone prévue ne doit pas remplacer la page.
addEventListener("dragover", (e) => e.preventDefault());
addEventListener("drop", (e) => e.preventDefault());
