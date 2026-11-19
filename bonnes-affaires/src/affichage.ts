// Le classement, dans le terminal et dans une page HTML à ouvrir dans le navigateur.
import type { Offre } from "./types.ts";

const euros = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: n % 1 ? 2 : 0 });

const pct = (o: Offre) => `−${Math.round(o.ecartPct * 100)} %`;

export function livraisonTexte(o: Offre): string {
  const ou = o.distanceKm != null ? `${o.distanceKm} km${o.procheDe ? ` de ${o.procheDe}` : ""}` : (o.ville ?? o.codePostal);
  if (o.dansZone) return `${ou} · à aller chercher`;
  const envoi = o.livrable
    ? o.port == null ? "livrable (port ?)" : o.port === 0 ? "livraison offerte" : `livraison ${euros(o.port)}`
    : "main propre, lieu à vérifier";
  return ou ? `${ou} · ${envoi}` : envoi;
}

const PICTO = { "sûr": "✅", "à vérifier": "🟠", "méfiance": "⛔" } as const;

export function texteTerminal(offres: Offre[], nombre: number): string {
  if (!offres.length) return "Aucune bonne affaire pour l'instant avec ces réglages.";
  const bloc = (o: Offre, i: number, detail: boolean) =>
    [
      `${String(i + 1).padStart(2)}. ${PICTO[o.surete]} ${o.titre}  [${o.site}]`,
      `    ${euros(o.total)} au lieu de ~${euros(o.prixHabituel)} (${pct(o)}, revente ≈ ${euros(o.gainRevente)}) · ${livraisonTexte(o)}`,
      ...(detail ? o.raisons.map((r) => `    ${r}`) : []),
      `    ${o.lien}`,
    ].join("\n");
  const choix = offres.filter((o) => o.choix);
  const autres = offres.filter((o) => !o.choix).slice(0, Math.max(0, nombre - choix.length));
  return [
    `MES CHOIX (${choix.length})`,
    ...choix.map((o, i) => bloc(o, i, true)),
    ...(autres.length ? [`LES AUTRES (${autres.length})`, ...autres.map((o, i) => bloc(o, choix.length + i, false))] : []),
  ].join("\n\n");
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const classeSurete = { "sûr": "sur", "à vérifier": "verif", "méfiance": "mefi" } as const;
const pastille = (o: Offre) => `<span class="pastille ${classeSurete[o.surete]}">${esc(o.surete)}</span>`;

const photo = (o: Offre, taille: string) =>
  o.photo
    ? `<a href="${esc(o.lien)}" target="_blank" rel="noopener noreferrer"><img class="${taille}" src="${esc(o.photo)}" alt="" loading="lazy" referrerpolicy="no-referrer"></a>`
    : `<div class="${taille} vide">pas de photo</div>`;

const raisons = (o: Offre) =>
  `<ul class="raisons">${o.raisons.map((r) => `<li class="${r.startsWith("+") ? "bon" : "mauvais"}">${esc(r.slice(2))}</li>`).join("")}</ul>`;

function carte(o: Offre, i: number): string {
  return `<article class="carte">
  ${photo(o, "grande")}
  <div class="corps">
    <div class="sous">n° ${i + 1} · ${esc(o.site)} · ${esc(o.recherche)}</div>
    <h3><a href="${esc(o.lien)}" target="_blank" rel="noopener noreferrer">${esc(o.titre)}</a></h3>
    <div class="prix"><b>${euros(o.total)}</b> <s>${euros(o.prixHabituel)}</s> <span class="fort">${pct(o)}</span> ${pastille(o)}</div>
    <div class="sous">${esc(livraisonTexte(o))} · revente ≈ ${euros(o.gainRevente)}</div>
    ${raisons(o)}
  </div>
</article>`;
}

export function pageHtml(offres: Offre[], quand: Date): string {
  const choix = offres.filter((o) => o.choix);
  const lignes = offres
    .map(
      (o, i) => `<tr>
  <td class="n">${i + 1}</td>
  <td>${photo(o, "petite")}</td>
  <td><a href="${esc(o.lien)}" target="_blank" rel="noopener noreferrer">${esc(o.titre)}</a>
    <div class="sous">${esc(o.site)} · ${esc(o.recherche)}${o.etat ? ` · ${esc(o.etat)}` : ""}</div>
    <details><summary>${pastille(o)} pourquoi</summary>${raisons(o)}</details></td>
  <td class="n">${euros(o.total)}</td>
  <td class="n">${euros(o.prixHabituel)}<div class="sous">${esc(o.originePrix)}</div></td>
  <td class="n fort">${pct(o)}<div class="sous">${euros(o.ecart)}</div></td>
  <td class="n">${euros(o.gainRevente)}</td>
  <td>${esc(livraisonTexte(o))}</td>
</tr>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bonnes affaires</title>
<style>
:root{--fond:#fafaf7;--carte:#fff;--texte:#1d1d1b;--doux:#6b6b66;--ligne:#e4e2dc;--vert:#1f7a4d;--orange:#b25e00;--rouge:#b3261e}
@media (prefers-color-scheme:dark){:root{--fond:#161615;--carte:#1f1f1d;--texte:#ecebe6;--doux:#9b9a94;--ligne:#2e2d2a;--vert:#5cc28d;--orange:#f0a04b;--rouge:#f2867d}}
body{margin:0;padding:24px 16px;background:var(--fond);color:var(--texte);font:15px/1.45 system-ui,sans-serif;max-width:1200px;margin-inline:auto}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 12px}p{color:var(--doux);margin:0 0 18px}
a{color:inherit}.sous{font-size:12px;color:var(--doux)}.fort{color:var(--vert);font-weight:600}
.choix{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
.carte{display:flex;gap:12px;background:var(--carte);border:1px solid var(--ligne);border-radius:12px;padding:12px}
.carte h3{font-size:15px;margin:2px 0 6px}.prix{margin-bottom:4px}.prix s{color:var(--doux);font-size:13px}
.grande,.petite{object-fit:cover;border-radius:8px;background:var(--ligne);flex:none;display:block}
.grande{width:110px;height:110px}.petite{width:72px;height:72px}
.vide{display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--doux);text-align:center}
.pastille{display:inline-block;font-size:11px;font-weight:600;padding:1px 8px;border-radius:99px;border:1px solid currentColor}
.sur{color:var(--vert)}.verif{color:var(--orange)}.mefi{color:var(--rouge)}
.raisons{margin:6px 0 0;padding:0;list-style:none;font-size:13px}.raisons li{padding-left:16px;position:relative}
.raisons li::before{position:absolute;left:0}.bon::before{content:"+";color:var(--vert)}.mauvais::before{content:"−";color:var(--orange)}
.tableau{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:900px}
th,td{padding:10px 8px;border-bottom:1px solid var(--ligne);vertical-align:top;text-align:left}
td:nth-child(3){min-width:260px}th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--doux)}
.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
summary{cursor:pointer;font-size:12px;color:var(--doux);margin-top:6px}
</style></head><body>
<h1>Bonnes affaires</h1>
<p>${offres.length} offre(s) · mis à jour le ${quand.toLocaleString("fr-FR")} · le prix habituel est une estimation : vérifiez toujours l'annonce avant d'acheter.</p>
<h2>Mes choix</h2>
<p>Le meilleur compromis entre le prix, la sûreté et la distance. Les offres « méfiance » n'y figurent jamais.</p>
<div class="choix">${choix.map((o) => carte(o, offres.indexOf(o))).join("\n") || "<p>Rien de sûr et intéressant pour l'instant.</p>"}</div>
<h2>Toutes les offres</h2>
<div class="tableau"><table>
<thead><tr><th class="n">#</th><th>Photo</th><th>Annonce</th><th class="n">Prix total</th><th class="n">Prix habituel</th><th class="n">Écart</th><th class="n">Revente</th><th>Distance / livraison</th></tr></thead>
<tbody>
${lignes || '<tr><td colspan="8">Aucune bonne affaire pour l\'instant.</td></tr>'}
</tbody></table></div>
</body></html>`;
}
