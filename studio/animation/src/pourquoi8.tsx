/**
 * La Psycho Facile — « Pourquoi tu… » #32 à #45 (lot 3), avec le modèle réglable de pourquoi7.tsx.
 */
import type React from "react";
import {
  Baby, Brain, Coffee, Eye, Gauge, Hand, Headphones, Heart, Laugh, Layers, Lightbulb, Megaphone, Music, Phone,
  Repeat, Scale, Settings, Sparkles, Star, Tag, Timer, Tv, Users, Utensils, Volume2,
} from "lucide-react";
import type { SceneProps } from "./types";
import { JAUNE, ROUGE } from "./spectateur";
import { S } from "./pourquoi7";

const VERT = "#4CD18B";
type I = React.FC<{ size?: number; color?: string; strokeWidth?: number }>;
const i = (x: unknown) => x as I;

export const ScenesPourquoi8: Record<string, React.FC<SceneProps>> = {
  // #32 simple exposition
  pq_se_accroche: S({ icone: i(Music), pastilles: [["détestais", "détestée… puis aimée", ROUGE]] }),
  pq_se_etude: S({ grand: ["vingt-cinq", "× 25"], icone: i(Repeat), pastilles: [["agréables", "plus vu = plus aimé"]] }),
  pq_se_pourquoi: S({ icone: i(Brain), pastilles: [["familier", "familier = rassurant", VERT]] }),
  pq_se_partout: S({ icone: i(Tv), pastilles: [["boucle", "les pubs en boucle", "#fff"], ["plaire", "les tubes de la radio"]] }),
  pq_se_astuce: S({ icone: i(Repeat), fondIcone: ROUGE, couleurIcone: "#fff", pastilles: [["marre", "trop, c'est trop", ROUGE]] }),
  // #33 Dunning-Kruger
  pq_dk_accroche: S({ icone: i(Gauge), perso: true, pastilles: [["sûrs", "moins on sait, plus on est sûr"]] }),
  pq_dk_etude: S({ grand: ["62e", "12e → « 62e »"], icone: i(Gauge), pastilles: [["1999", "tests de logique", "#fff"]] }),
  pq_dk_pourquoi: S({ icone: i(Eye), pastilles: [["erreurs", "pour voir ses erreurs…", "#fff"], ["manque", "… il faut déjà savoir"]] }),
  pq_dk_meilleurs: S({ icone: i(Star), fondIcone: VERT, couleurIcone: "#fff", pastilles: [["sous-estimer", "les meilleurs se sous-estiment"]] }),
  pq_dk_astuce: S({ icone: i(Users), pastilles: [["d'expérimenté", "demande à quelqu'un d'expérimenté"]] }),
  // #34 ancrage
  pq_an_accroche: S({ icone: i(Tag), pastilles: [["décision", "le 1er chiffre décide"]] }),
  pq_an_roue: S({ icone: i(Settings), pastilles: [["10", "roue : 10", "#fff"], ["65", "ou 65"]] }),
  pq_an_resultat: S({ grand: ["25", "25 % vs 45 %"], icone: i(Scale), pastilles: [["hasard", "un chiffre au hasard"]] }),
  pq_an_vente: S({ icone: i(Tag), fondIcone: ROUGE, couleurIcone: "#fff", pastilles: [["barré", "le prix barré", ROUGE]] }),
  pq_an_astuce: S({ icone: i(Tag), fondIcone: VERT, couleurIcone: "#fff", pastilles: [["toi-même", "fixe ton prix avant"]] }),
  // #35 rire contagieux
  pq_ri_accroche: S({ icone: i(Laugh), foule: { n: 5, jaunes: 5, mot: "rit" }, pastilles: [["pourquoi", "sans savoir pourquoi"]] }),
  pq_ri_trente: S({ grand: ["30", "× 30"], icone: i(Users), pastilles: [["seul", "à plusieurs plutôt que seul"]] }),
  pq_ri_enregistre: S({ icone: i(Tv), pastilles: [["enregistré", "même un rire enregistré"]] }),
  pq_ri_lien: S({ icone: i(Heart), fondIcone: ROUGE, couleurIcone: "#fff", pastilles: [["lien", "le rire crée du lien"]] }),
  pq_ri_astuce: S({ icone: i(Laugh), fondIcone: VERT, couleurIcone: "#fff", pastilles: [["lui", "ris avec les autres"]] }),
  // #36 amnésie infantile
  pq_ae_accroche: S({ icone: i(Baby), pastilles: [["trois", "avant 3 ans : rien"]] }),
  pq_ae_nom: S({ icone: i(Brain), grand: ["infantile", "amnésie infantile"], pastilles: [["rien", "les bébés retiennent pourtant", "#fff"]] }),
  pq_ae_etude: S({ grand: ["2014", "2014"], icone: i(Baby), pastilles: [["bien", "à 3 ans : bons souvenirs", VERT], ["disparu", "plus tard : effacés", ROUGE]] }),
  pq_ae_pourquoi: S({ icone: i(Sparkles), pastilles: [["neurones", "beaucoup de nouveaux neurones"], ["effacer", "une piste, pas une certitude", "#fff"]] }),
  pq_ae_photos: S({ icone: i(Eye), pastilles: [["photos", "souvent : les photos", "#fff"], ["racontées", "et les histoires racontées"]] }),
  // #37 horoscope
  pq_ho_accroche: S({ icone: i(Star), pastilles: [["toi", "ça parle de toi ?"]] }),
  pq_ho_test: S({ grand: ["1949", "1949"], icone: i(Users), pastilles: [["personnalisé", "un portrait « personnalisé »"]] }),
  pq_ho_note: S({ grand: ["4,26", "4,26 / 5"], icone: i(Star), pastilles: [["même", "le même texte pour tous", ROUGE]] }),
  pq_ho_phrases: S({ icone: i(Megaphone), pastilles: [["apprécié", "« besoin d'être apprécié »", "#fff"], ["réservé", "« parfois réservé »"]] }),
  pq_ho_astuce: S({ icone: i(Users), fondIcone: VERT, couleurIcone: "#fff", pastilles: [["monde", "ça marche pour tout le monde ?"]] }),
  // #38 paresse sociale
  pq_pg_accroche: S({ icone: i(Users), foule: { n: 5, jaunes: 1, mot: "groupe" }, pastilles: [["seul", "en groupe, chacun en fait moins"]] }),
  pq_pg_etude: S({ grand: ["1979", "1979"], icone: i(Megaphone), pastilles: [["crier", "crier, applaudir"], ["six", "seul… puis à 6", "#fff"]] }),
  pq_pg_resultat: S({ grand: ["36", "36 %", ROUGE], foule: { n: 6, jaunes: 2, mot: "36" } }),
  pq_pg_pourquoi: S({ icone: i(Eye), pastilles: [["voit", "ton effort se voit moins"], ["économise", "ton cerveau économise", "#fff"]] }),
  pq_pg_astuce: S({ icone: i(Hand), fondIcone: VERT, couleurIcone: "#fff", pastilles: [["nom", "une part, un nom"]] }),
  // #39 option par défaut
  pq_od_accroche: S({ icone: i(Settings), pastilles: [["place", "choisi à ta place"]] }),
  pq_od_pays: S({ grand: ["28", "4 à 28 %", ROUGE], icone: i(Heart), pastilles: [["cocher", "cocher pour donner", "#fff"]] }),
  pq_od_inverse: S({ grand: ["100", "86 à ~100 %", VERT], icone: i(Heart), pastilles: [["refuser", "cocher pour refuser", "#fff"]] }),
  pq_od_pourquoi: S({ icone: i(Layers), pastilles: [["effort", "changer = un effort"], ["rien", "garder = rien", "#fff"]] }),
  pq_od_astuce: S({ icone: i(Settings), fondIcone: VERT, couleurIcone: "#fff", pastilles: [["abonnements", "vérifie tes abonnements"]] }),
  // #40 multitâche
  pq_mt_accroche: S({ icone: i(Layers), pastilles: [["efficace", "plusieurs choses = moins efficace", ROUGE]] }),
  pq_mt_saute: S({ icone: i(Repeat), pastilles: [["saute", "le cerveau saute", "#fff"], ["temps", "chaque saut coûte du temps"]] }),
  pq_mt_etude: S({ grand: ["2009", "2009"], icone: i(Phone), pastilles: [["distractions", "moins bons contre les distractions", ROUGE]] }),
  pq_mt_illusion: S({ icone: i(Sparkles), pastilles: [["productif", "« je suis productif »", "#fff"], ["illusion", "une illusion", ROUGE]] }),
  pq_mt_astuce: S({ icone: i(Timer), fondIcone: VERT, couleurIcone: "#fff", grand: ["vingt-cinq", "25 min"], pastilles: [["pièce", "téléphone dans une autre pièce"]] }),
  // #41 FOMO
  pq_fo_accroche: S({ icone: i(Phone), perso: true, pastilles: [["rater", "la peur de rater"]] }),
  pq_fo_nom: S({ grand: ["rater", "FOMO"], icone: i(Users), pastilles: [["toi", "« ils s'amusent sans moi »", "#fff"]] }),
  pq_fo_etude: S({ grand: ["2013", "2013"], icone: i(Phone), pastilles: [["réseaux", "plus de réseaux", "#fff"], ["satisfait", "moins satisfait", ROUGE]] }),
  pq_fo_cercle: S({ icone: i(Repeat), fondIcone: ROUGE, couleurIcone: "#fff", pastilles: [["cercle", "un cercle", ROUGE]] }),
  pq_fo_astuce: S({ icone: i(Star), pastilles: [["meilleurs", "tu vois leurs meilleurs moments"], ["canapé", "pas leurs soirées canapé", "#fff"]] }),
  // #42 manger devant un écran
  pq_me_accroche: S({ icone: i(Tv), perso: true, pastilles: [["écran", "écran = on mange plus"]] }),
  pq_me_etude: S({ grand: ["24", "24 études"], icone: i(Utensils), pastilles: [["distrait", "distrait…"], ["après", "… plus de faim après", ROUGE]] }),
  pq_me_memoire: S({ icone: i(Brain), pastilles: [["souvient", "repas mal enregistré", "#fff"], ["redemande", "il en redemande"]] }),
  pq_me_astuce: S({ icone: i(Utensils), fondIcone: VERT, couleurIcone: "#fff", pastilles: [["assiette", "regarde ton assiette"]] }),
  // #43 savoir attendre
  pq_ar_accroche: S({ icone: i(Timer), pastilles: [["devant", "attendre, c'est dur"]] }),
  pq_ar_test: S({ grand: ["deux", "1 maintenant… ou 2"], icone: i(Sparkles) }),
  pq_ar_secret: S({ icone: i(Eye), pastilles: [["secret", "le secret"], ["ailleurs", "regarder ailleurs", "#fff"]] }),
  pq_ar_honnete: S({ icone: i(Scale), pastilles: [["faible", "le lien avec la réussite : plus faible", "#fff"]] }),
  pq_ar_astuce: S({ icone: i(Eye), fondIcone: VERT, couleurIcone: "#fff", pastilles: [["yeux", "la tentation hors de vue"]] }),
  // #44 bruit de fond
  pq_bf_accroche: S({ icone: i(Coffee), pastilles: [["silencieuse", "café bruyant > silence ?"]] }),
  pq_bf_etude: S({ grand: ["70", "70 dB"], icone: i(Volume2), pastilles: [["café", "le bruit d'un café", "#fff"]] }),
  pq_bf_pourquoi: S({ icone: i(Lightbulb), pastilles: [["large", "penser plus large"]] }),
  pq_bf_trop: S({ grand: ["85", "85 dB", ROUGE], icone: i(Headphones), pastilles: [["calme", "réviser : le calme", "#fff"]] }),
  pq_bf_astuce: S({ icone: i(Coffee), fondIcone: VERT, couleurIcone: "#fff", pastilles: [["idées", "idées : un fond de café"], ["silence", "révisions : le silence", "#fff"]] }),
  // #45 ceux qui nous ressemblent
  pq_qr_accroche: S({ icone: i(Users), foule: { n: 4, jaunes: 2, mot: "ressemblent" } }),
  pq_qr_etude: S({ grand: ["1961", "1961"], icone: i(Users), pastilles: [["appréciaient", "mêmes avis = plus apprécié"]] }),
  pq_qr_pourquoi: S({ icone: i(Heart), pastilles: [["rassure", "il te rassure"], ["raison", "« j'ai raison »", "#fff"]] }),
  pq_qr_percu: S({ icone: i(Eye), pastilles: [["imagines", "la ressemblance imaginée"]] }),
  pq_qr_astuce: S({ icone: i(Users), fondIcone: VERT, couleurIcone: "#fff", pastilles: [["différents", "parle aux gens différents"]] }),
};
void JAUNE;
