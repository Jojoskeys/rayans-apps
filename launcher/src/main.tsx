import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyPrefs, loadPrefs } from "./prefs";
import "./styles.css";

// Couleurs et réglages appliqués avant le premier rendu : pas de flash de l'ancien thème.
applyPrefs(loadPrefs());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
