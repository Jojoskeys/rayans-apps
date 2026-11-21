// Vue 3D de l'Arène (tuile Arène), chargée seulement quand on l'affiche (import dynamique depuis arene-film.tsx).
// Même film que la 2D, même horloge et même scénario (shared/film.ts) : sur la piste de blender/arene (arene.glb),
// les robots (robot-<famille>.glb, couleurs du modèle) se promènent à petits sauts, grossissent selon leur rang, les
// perdants grisent et s'enfoncent dans le sol, les enfants sortent à côté de leur parent, la couronne (couronne.glb)
// suit le mieux noté ; puis le sacre de la vraie championne et la course de l'examen, où la distance parcourue suit le
// gain cumulé, contre le robot doré « acheter et garder ». Pour tenir 60 images/s sur iPhone avec 200 robots : un seul
// InstancedMesh par morceau de robot (corps, yeux, pupilles, pieds), la couleur de chaque robot posée par instance.
import {
  Color, DirectionalLight, Fog, HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PCFShadowMap, PerspectiveCamera, PlaneGeometry, Quaternion, Scene, Vector3, WebGLRenderer, CanvasTexture,
  type BufferGeometry, type Group, type Material,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { bornesExamen, enTete, hasard, moment, naissances, placeChampion, position, rangs, surPiste, DUREES, type Film } from "../shared/film.ts";
import { pourcent } from "../shared/arene.ts";

const FAMILLES = ["croisement", "rebond", "momentum", "tendance"];   // même ordre que les types du film
const GRIS = new Color("#6b7280");
const FOND = "#151a21";
// La piste d'arene.glb : 6 couloirs de 40 m (x de 0 à 40), z de −7,2 à 7,2 ; grand écran au bout (x ≈ 44,6).
const PISTE = 40, COULOIR = 14.48 / 6;
// Zone où les robots se promènent pendant les générations (au milieu de la piste).
const ZX = 5, ZL = 30, ZH = 12.4;
const ou = (id: number, t: number) => { const p = position(id, t, ZL, ZH, 0, 0); return { x: ZX + p.x, z: p.y - ZH / 2 }; };
/** Cap (rotation autour de la verticale) d'un robot qui va dans la direction (dx, dz) : l'avant du modèle regarde +Z. */
const cap = (dx: number, dz: number) => Math.atan2(dx, dz);

let modeles: Promise<{ robots: Group[]; couronne: Group; arene: Group }> | null = null;
function charger() {
  if (!modeles) {
    const l = new GLTFLoader();
    const un = (nom: string) => l.loadAsync(`./modeles/${nom}.glb`).then((g) => g.scene);
    modeles = Promise.all([...FAMILLES, "acheter-et-garder"].map((f) => un(`robot-${f}`)).concat([un("couronne"), un("arene")]))
      .then((s) => ({ robots: s.slice(0, 5), couronne: s[5], arene: s[6] }));
    modeles.catch(() => { modeles = null; });   // réessayer la prochaine fois
  }
  return modeles;
}

/** Démarre la vue 3D dans `boite` ; `titre` reçoit les lignes d'en-tête. Rend la fonction qui l'arrête. */
export async function lancer3D(boite: HTMLElement, titre: HTMLElement, film: Film, avancer: (dt: number) => number): Promise<() => void> {
  const m = await charger();
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  const toile = renderer.domElement;
  toile.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none";
  boite.appendChild(toile);

  const scene = new Scene();
  scene.background = new Color(FOND);
  scene.fog = new Fog(FOND, 70, 130);
  scene.add(new HemisphereLight(0xe8eeff, 0x3a4250, 2.2));
  const soleil = new DirectionalLight(0xfff4e6, 2.4);
  soleil.position.set(8, 30, 14);
  soleil.target.position.set(20, 0, 0);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(1024, 1024);
  Object.assign(soleil.shadow.camera, { left: -27, right: 27, top: 16, bottom: -16, near: 5, far: 70 });
  soleil.shadow.camera.updateProjectionMatrix();
  soleil.shadow.bias = -0.0004; soleil.shadow.normalBias = 0.03; soleil.shadow.radius = 3;
  soleil.shadow.intensity = 0.55;   // ombres légères
  scene.add(soleil, soleil.target);

  // La piste, et un sol sombre tout autour.
  const sol = new Mesh(new PlaneGeometry(300, 300).rotateX(-Math.PI / 2), new MeshStandardMaterial({ color: "#1a1f27", roughness: 1 }));
  sol.position.set(20, -0.02, 0); sol.receiveShadow = true;
  scene.add(sol, m.arene);
  m.arene.traverse((o) => { if ((o as Mesh).isMesh) (o as Mesh).receiveShadow = true; });

  // Le grand écran au bout de la piste : génération en cours, puis examen.
  const ecranToile = Object.assign(document.createElement("canvas"), { width: 1024, height: 428 });
  const ecranTex = new CanvasTexture(ecranToile);
  ecranTex.colorSpace = "srgb";
  const ecran = new Mesh(new PlaneGeometry(14.2, 5.94), new MeshBasicMaterial({ map: ecranTex, toneMapped: false }));
  ecran.position.set(44.55, 5, 0); ecran.rotation.y = -Math.PI / 2;
  scene.add(ecran);
  let ecranTexte = "";
  const afficherEcran = (haut: string, bas: string) => {
    if (haut + bas === ecranTexte) return;
    ecranTexte = haut + bas;
    const c = ecranToile.getContext("2d")!;
    c.fillStyle = "#0f2a4d"; c.fillRect(0, 0, 1024, 428);
    c.fillStyle = "#ECEFF3"; c.textAlign = "center"; c.font = "700 120px -apple-system, system-ui, sans-serif";
    c.fillText(haut, 512, 190);
    c.fillStyle = "#9fc3ff"; c.font = "600 64px -apple-system, system-ui, sans-serif";
    c.fillText(bas, 512, 320);
    ecranTex.needsUpdate = true;
  };

  // Les robots : les morceaux du modèle (même forme pour toutes les familles), un InstancedMesh par morceau.
  const couleurs = m.robots.map((r) => {
    let c = new Color("#888");
    r.traverse((o) => { const mat = (o as Mesh).material as MeshStandardMaterial | undefined; if (mat?.name?.startsWith("corps")) c = mat.color.clone(); });
    return c;
  });
  const morceaux: { geo: BufferGeometry; mat: Material; corps: boolean }[] = [];
  m.robots[0].updateMatrixWorld(true);
  m.robots[0].traverse((o) => {
    const me = o as Mesh;
    if (!me.isMesh) return;
    const mat = (me.material as MeshStandardMaterial).clone();
    const corps = mat.name.startsWith("corps");
    if (corps) mat.color.set("#ffffff");   // la couleur vient de chaque instance
    morceaux.push({ geo: me.geometry.clone().applyMatrix4(me.matrixWorld), mat, corps });
  });
  const G = film.generations.length;
  let max = 2;
  for (let g = 0; g < G; g++) max = Math.max(max, film.generations[g].length + naissances(film.generations, g).length + 2);
  const instances = morceaux.map(({ geo, mat, corps }) => {
    const im = new InstancedMesh(geo, mat, max);
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.count = 0;
    if (corps) im.setColorAt(0, GRIS);
    scene.add(im);
    return { im, corps };
  });
  const couronne = m.couronne;
  couronne.traverse((o) => {
    const me = o as Mesh;
    if (!me.isMesh) return;
    me.castShadow = true;
    // sans reflets autour, un or 100 % métal paraît brun : un peu moins de métal, il reste doré
    const mat = me.material as MeshStandardMaterial;
    if (mat.isMeshStandardMaterial) { mat.metalness = Math.min(mat.metalness, 0.25); mat.roughness = Math.max(mat.roughness, 0.35); }
  });
  scene.add(couronne);

  const mat = new Matrix4(), q = new Quaternion(), pos = new Vector3(), ech = new Vector3(), Y = new Vector3(0, 1, 0), teinte = new Color();
  let n = 0;
  const poser = (x: number, y: number, z: number, rot: number, s: number, c: Color) => {
    if (n >= max || s <= 0.001) return;
    mat.compose(pos.set(x, y, z), q.setFromAxisAngle(Y, rot), ech.set(s, s, s));
    for (const { im, corps } of instances) { im.setMatrixAt(n, mat); if (corps) im.setColorAt(n, c); }
    n++;
  };
  const coiffer = (x: number, y: number, z: number, rot: number, s: number) => {
    couronne.visible = true;
    couronne.position.set(x, y + 1.32 * s, z); couronne.rotation.set(0, rot, 0); couronne.scale.setScalar(0.85 * s);
  };
  const saut = (id: number, t: number, s: number, vite = 6) => Math.abs(Math.sin(t * vite + hasard(id, 7) * 6)) * 0.22 * s;

  // Caméra : tourne lentement toute seule, se laisse tourner au doigt ; elle suit l'action (cible et distance).
  const camera = new PerspectiveCamera(42, 1, 0.5, 220);
  camera.position.set(6, 27, 34);
  const ctl = new OrbitControls(camera, toile);
  ctl.target.set(20, 0, 0);
  Object.assign(ctl, { enableDamping: true, enablePan: false, enableZoom: false, autoRotate: true, autoRotateSpeed: 0.5, minPolarAngle: 0.35, maxPolarAngle: 1.32 });
  const cible = new Vector3(20, 0, 0), ecart = new Vector3();
  let distance = 37;

  const rangsParGen = film.generations.map(rangs);
  const place = placeChampion(film);
  const ch = { id: film.champion.id, type: film.champion.type };
  const { lo, hi } = bornesExamen(film.examen);
  const xCourse = (v: number) => 2 + surPiste(v, lo, hi, PISTE - 4);

  // En-tête en HTML (net et lisible), réécrit seulement quand il change.
  let titreCle = "";
  const entete = (lignes: { t: string; c?: string; g?: boolean }[]) => {
    const cle = lignes.map((l) => l.t).join("|");
    if (cle === titreCle) return;
    titreCle = cle;
    titre.replaceChildren(...lignes.map((l, k) => {
      const d = document.createElement("div");
      d.textContent = l.t;
      d.style.cssText = `font-size:${k === 0 ? 15 : 13}px;font-weight:${k === 0 || l.g ? 600 : 400};color:${l.c ?? (k === 0 ? "#ECEFF3" : "#C3CAD6")};line-height:1.35`;
      return d;
    }));
  };
  const aide = document.createElement("div");
  aide.textContent = "↻ glisse pour tourner";
  aide.style.cssText = "position:absolute;right:12px;bottom:9px;font-size:11.5px;color:#9AA3B2;pointer-events:none;opacity:.8;z-index:1";
  boite.appendChild(aide);
  const css = (c: Color) => `#${c.getHexString()}`;
  // Pendant la course, le nom de chaque coureur au-dessus de sa tête (la championne peut être orange comme l'or).
  const etiquettes = ["Championne", "Acheter et garder"].map((t) => {
    const e = document.createElement("div");
    e.textContent = t;
    e.style.cssText = "position:absolute;left:0;top:0;font-size:12px;font-weight:600;color:#ECEFF3;background:#111418b3;padding:2px 7px;border-radius:99px;pointer-events:none;white-space:nowrap;display:none;z-index:1";
    boite.appendChild(e);
    return e;
  });
  const audessus = [new Vector3(), new Vector3()];

  // Taille du dessin = taille de la boîte.
  const taille = () => {
    const w = boite.clientWidth, h = boite.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(taille); ro.observe(boite); taille();
  let visible = true;
  const io = new IntersectionObserver((e) => { visible = e[0]?.isIntersecting ?? true; }); io.observe(boite);

  let raf = 0, avant = performance.now(), aideVue = 0;
  const image = (maintenant: number) => {
    raf = requestAnimationFrame(image);
    const dt = Math.min(0.1, (maintenant - avant) / 1000); avant = maintenant;
    const t = avancer(dt);
    if (!visible) return;
    const mo = moment(film, t);
    n = 0; couronne.visible = false;

    if (mo.phase === "generation") {
      const { g, ph } = mo, gen = film.generations[g], rg = rangsParGen[g], best = enTete(gen);
      entete([{ t: `Génération ${g + 1} / ${G}` }, { t: `En tête 👑 : ${pourcent(best[3])} sur ${film.entrainement}` }]);
      afficherEcran(`Génération ${g + 1}/${G}`, `En tête : ${pourcent(best[3])}`);
      const grandit = Math.min(1, ph / 1.2);
      for (const a of gen) {
        const p = ou(a[0], t), p2 = ou(a[0], t + 0.05), rot = cap(p2.x - p.x, p2.z - p.z);
        const s = 0.9 + 1.1 * grandit * (rg.get(a[0]) ?? 0);
        if (!a[4] && ph >= DUREES.MORTS) {
          // perdant : il grise, rapetisse et s'enfonce dans le sol
          const k = Math.min(1, (ph - DUREES.MORTS) / 0.7);
          if (k < 1) poser(p.x, -1.5 * s * k, p.z, rot, s * (1 - 0.35 * k), teinte.copy(couleurs[a[2]]).lerp(GRIS, Math.min(1, k * 2.5)));
        } else {
          const y = saut(a[0], t, s);
          poser(p.x, y, p.z, rot, s, couleurs[a[2]]);
          if (a[0] === best[0]) coiffer(p.x, y, p.z, rot, s);
        }
      }
      if (ph >= DUREES.NAISSANCES) {
        const k = Math.min(1, (ph - DUREES.NAISSANCES) / 0.6);
        for (const b of naissances(film.generations, g)) {
          const pp = ou(b.parent, t), pe = ou(b.id, t);
          const x = pp.x + (pe.x - pp.x) * k, z = pp.z + (pe.z - pp.z) * k, s = 0.9 * (0.3 + 0.7 * k);
          poser(x, saut(b.id, t, s), z, cap(pe.x - pp.x, pe.z - pp.z), s, couleurs[b.type]);
        }
      }
      cible.set(20, 0, 0); distance = 37;
    } else if (mo.phase === "sacre") {
      const { k } = mo;
      entete([{ t: "La championne" }, { t: `${pourcent(film.champion.entrainement)} sur ${film.entrainement} : elle a l'air géniale.` }]);
      afficherEcran("La championne", `${pourcent(film.champion.entrainement)} sur ${film.entrainement}`);
      for (const a of film.generations[G - 1]) if (place.ne || a[0] !== place.id) {
        const p = ou(a[0], t), p2 = ou(a[0], t + 0.05);
        poser(p.x, saut(a[0], t, 0.9), p.z, cap(p2.x - p.x, p2.z - p.z), 0.9 * (1 - 0.3 * k), teinte.copy(couleurs[a[2]]).lerp(GRIS, 0.75 * k));
      }
      const p0 = ou(place.id, t), x = p0.x + (20 - p0.x) * k, z = p0.z + (0 - p0.z) * k, s = 0.9 + 1.9 * k;
      // elle se tourne vers nous
      const rot = cap(camera.position.x - x, camera.position.z - z), y = k < 1 ? 0 : saut(ch.id, t, s * 0.5, 4);
      poser(x, y, z, rot, s, couleurs[ch.type]);
      coiffer(x, y, z, rot, s);
      cible.set(20, 1.6, 0); distance = 15;
    } else {
      const ex = film.examen, i = mo.i, nj = ex.dates.length;
      // entre deux jours, la position glisse pour que la course reste fluide
      const fi = mo.te * (nj - 1), j0 = Math.min(nj - 1, Math.floor(fi)), j1 = Math.min(nj - 1, j0 + 1), f = fi - j0;
      const vC = ex.champion[j0] + (ex.champion[j1] - ex.champion[j0]) * f, vA = ex.ag[j0] + (ex.ag[j1] - ex.ag[j0]) * f;
      const debut = Math.min(1, (t - G * DUREES.GEN - DUREES.SACRE) / 0.8);
      const zC = -COULOIR / 2, zA = COULOIR / 2;
      const xC = 20 + (xCourse(vC) - 20) * debut, zc = zC * debut, sC = 2.8 - 1.4 * debut;
      const court = mo.te < 1;
      const yC = court ? saut(ch.id, t, sC, 11) : 0, yA = court ? saut(-1, t, 1.3, 11) : 0;
      poser(xC, yC, zc, Math.PI / 2, sC, couleurs[ch.type]);
      coiffer(xC, yC, zc, Math.PI / 2, sC);
      poser(xCourse(vA), yA, zA, Math.PI / 2, 1.3 * debut, couleurs[4]);
      entete([
        { t: `L'examen : ${film.test}, jamais vue` },
        { t: `● Championne ${pourcent(ex.champion[i])}`, c: css(couleurs[ch.type]), g: true },
        { t: `● Acheter et garder ${pourcent(ex.ag[i])}`, c: css(couleurs[4]), g: true },
        { t: ex.dates[i]?.split("-").reverse().join("/") ?? "" },
      ]);
      afficherEcran(`Examen ${film.test}`, `${pourcent(ex.champion[i])}  contre  ${pourcent(ex.ag[i])}`);
      cible.set((xC + xCourse(vA)) / 2, 1, 0); distance = 19;
      audessus[0].set(xC, yC + 2.1 * sC, zc); audessus[1].set(xCourse(vA), yA + 2.3, zA);
    }
    const course = mo.phase === "examen";
    for (const { im, corps } of instances) {
      im.count = n; im.instanceMatrix.needsUpdate = true;
      if (corps && im.instanceColor) im.instanceColor.needsUpdate = true;
    }

    // la caméra glisse vers sa cible et sa distance, en gardant l'angle choisi au doigt
    const a = 1 - Math.exp(-dt * 2.2);
    ctl.target.lerp(cible, a);
    ctl.update(dt);
    ecart.subVectors(camera.position, ctl.target);
    ecart.setLength(ecart.length() + (distance - ecart.length()) * a);
    camera.position.copy(ctl.target).add(ecart);
    if (aideVue < 6) { aideVue += dt; if (aideVue >= 6) aide.style.opacity = "0"; }
    etiquettes.forEach((e, k) => {
      const p = audessus[k].clone().project(camera);
      const vu = course && p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
      e.style.display = vu ? "block" : "none";
      if (vu) e.style.transform = `translate(${((p.x + 1) / 2) * boite.clientWidth}px, ${((1 - p.y) / 2) * boite.clientHeight}px) translate(-50%, -100%)`;
    });
    renderer.render(scene, camera);
  };
  aide.style.transition = "opacity .8s";
  raf = requestAnimationFrame(image);

  return () => {
    cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); ctl.dispose();
    for (const { im } of instances) { im.geometry.dispose(); (im.material as Material).dispose(); im.dispose(); }
    sol.geometry.dispose(); (sol.material as Material).dispose(); ecran.geometry.dispose(); ecranTex.dispose();
    scene.clear();
    renderer.dispose(); renderer.forceContextLoss();
    toile.remove(); aide.remove(); for (const e of etiquettes) e.remove(); titre.replaceChildren();
  };
}
