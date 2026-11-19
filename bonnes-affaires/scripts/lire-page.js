// Lecteurs de page pour le relevé sur demande (voir README, « Relevé sur demande »).
// Claude exécute l'un des deux dans son navigateur intégré, sur une page de recherche déjà ouverte, après
// avoir remplacé NOM (fichier d'import, ex. lbc-switch-ville1) et RECHERCHE (nom exact dans reglages.json).
// Ils ne font que lire ce que la page affiche déjà : aucune requête en plus, aucun compte.

// Leboncoin : annonces de la page (titre, prix, lien, code postal, position, livrable, photo).
const s = (window.__NEXT_DATA__ || JSON.parse(document.getElementById("__NEXT_DATA__").textContent)).props.pageProps.searchData;
"BA1|NOM|RECHERCHE|" + JSON.stringify(s.ads.filter((a) => a.price?.[0] > 0).map((a) => [
  a.subject.slice(0, 70), a.price[0], a.url.split("/ad/")[1], a.location.zipcode, a.location.lat, a.location.lng,
  a.attributes.some((x) => x.key === "shipping_type" && x.value !== "face_to_face") ? 1 : 0,
  (a.images?.urls?.[0] || "").split("/images/")[1]?.split("?")[0] || "",
]));

// Vinted : 60 premières annonces (titre, prix protection acheteur comprise, identifiant, état, taille, photo).
const v = [...document.querySelectorAll('a[data-testid$="--overlay-link"]')].slice(0, 60).map((a) => {
  const m = (a.getAttribute("title") || "").match(/^(.*?), Marque: ([^,]*), (?:État: ([^,]*), )?(?:Taille: ([^,]*), )?([\d.]+) €, ([\d.]+) €/);
  const img = (a.closest('[data-testid$="--container"]') || a.parentElement)?.querySelector("img")?.src || "";
  return m ? [m[1].slice(0, 70), +m[6], a.href.split("/items/")[1].split("?")[0].split("-")[0], m[3] || "", m[4] || "", img] : null;
}).filter(Boolean);
"BA1|NOM|RECHERCHE|" + JSON.stringify(v);

// Vestiaire Collective : annonces de la page (titre = marque, type et description, prix actuel, lien, taille, photo).
// Les titres ne donnent pas le modèle exact : à utiliser pour des recherches de marque (ex. « ralph lauren »).
const vc = [...document.querySelectorAll('a[href*=".shtml"]')].slice(0, 60).map((a) => {
  const t = a.innerText.replace(/\s+/g, " ").trim();
  const prix = [...t.matchAll(/([\d\s]+(?:,\d+)?) €/g)].map((m) => +m[1].replace(/\s/g, "").replace(",", "."));
  const m = t.match(/^(.*?) (?:(\S+) International )?[\d\s,]+ €/);
  const slug = a.pathname.split("/").pop().replace(/-\d+\.shtml$/, "").replace(/-/g, " ");
  return prix.length ? [(m?.[1] || "") + " · " + slug, prix[prix.length - 1], a.pathname, m?.[2] || "", a.querySelector("img")?.src || ""] : null;
}).filter(Boolean);
"BA1|NOM|RECHERCHE|" + JSON.stringify(vc);
