// Remplace @tauri-apps/* dans la web app : ces fonctions ne sont jamais appelées hors de l'app Windows
// (isTauri est faux), mais les modules doivent exister pour l'assemblage.
const absent = () => { throw new Error("fonction réservée à l'app Windows"); };
export const invoke = absent;
export const open = absent;
export const save = absent;
export default {};
