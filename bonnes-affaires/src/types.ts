// Les formes de données partagées par toute l'app.

/** Une annonce, quel que soit le site d'où elle vient. Prix en euros. */
export interface Annonce {
  site: string;
  titre: string;
  prix: number;
  /** Frais de port, null si inconnus ou remise en main propre seulement. */
  port: number | null;
  lien: string;
  /** Nom de la recherche à laquelle l'annonce répond (rempli au classement si absent). */
  recherche?: string;
  etat?: string;
  /** Adresse (https) de la photo principale de l'annonce. */
  photo?: string;
  codePostal?: string;
  ville?: string;
  lat?: number;
  lon?: number;
  /** Distance en km depuis le point de départ le plus proche, calculée si possible. */
  distanceKm?: number | null;
  /** Nom du point de départ le plus proche (ex. « Ville A »). */
  procheDe?: string;
  /** Avis sur le vendeur quand le site le donne (eBay) : % d'avis positifs et nombre d'avis. */
  vendeur?: { notePct?: number; avis?: number };
  livrable: boolean;
  remiseEnMain: boolean;
  /** Prix habituel donné par la source elle-même (ex. ligne d'import), prioritaire. */
  prixHabituel?: number;
}

export interface Recherche {
  nom: string;
  /** Mots à chercher ; une annonce importée y correspond si elle contient tous ces mots. */
  mots: string;
  categorie: "vetements" | "electronique" | "autre";
  /** Prix habituel connu (neuf ou occasion courante). Sinon : médiane des annonces trouvées. */
  prixHabituel?: number;
  prixMax?: number;
  /** Mots qui écartent une annonce (en plus de la liste par défaut). */
  exclure?: string[];
}

export interface Domicile {
  nom: string;
  codePostal: string;
}

export interface Reglages {
  /** Points de départ pour aller chercher un objet. Restent dans reglages.json, ignoré par git. */
  domiciles: Domicile[];
  /** Ancien réglage à un seul point de départ, encore accepté. */
  codePostal?: string;
  /** Rayon de la zone de retrait autour de chaque point de départ (main propre). */
  distanceMaxKm: number;
  /** Plus loin que la zone, jusqu'à cette distance, seulement pour une pépite (on fait le trajet). */
  distancePepiteKm: number;
  /** Écart minimal pour qu'une offre sûre soit une pépite (0,4 = 40 % moins cher) : notification sur l'iPhone. */
  ecartPepite: number;
  /** Gain minimal à la revente pour une pépite (en euros) : pas de notification pour quelques euros. */
  gainPepite: number;
  /** Écart minimal avec le prix habituel pour figurer au classement (0,25 = 25 % moins cher). */
  ecartMin: number;
  /** Part prélevée à la revente (commission, envoi), pour estimer le gain. */
  fraisRevente: number;
  /** Nombre d'offres affichées. */
  nombre: number;
  ebay?: { clientId: string; clientSecret: string };
  /** Bot Discord (bot.ts) : salon où envoyer les bonnes affaires. */
  discord?: {
    /** Lien du webhook du salon (vaut un mot de passe : reste dans reglages.json). */
    webhook: string;
    /** Envoyer aussi les grosses promos Dealabs hors de mes recherches. */
    grossesPromos?: boolean;
    /** Grosse promo : bon plan au moins aussi « chaud » (votes de la communauté)… */
    degresMin?: number;
    /** …ou au moins cette réduction sur son prix habituel (0,5 = 50 %). */
    reductionMin?: number;
  };
  recherches: Recherche[];
}

export interface Offre extends Annonce {
  recherche: string;
  categorie: Recherche["categorie"];
  prixHabituel: number;
  /** D'où vient le prix habituel : réglage, import, ou médiane de N annonces. */
  originePrix: string;
  /** Prix + port (port compté 0 en remise en main propre). */
  total: number;
  ecart: number;
  ecartPct: number;
  /** Gain estimé si on revend au prix habituel, frais de revente déduits. */
  gainRevente: number;
  /** Dans la zone de retrait : on peut aller voir et essayer l'objet. */
  dansZone: boolean;
  surete: Surete;
  /** Pourquoi cet avis : ce qui rassure (+) et ce qui inquiète (−). */
  raisons: string[];
  /** Note finale qui sert au classement (écart, sûreté, proximité). */
  score: number;
  /** Mis en avant comme l'un des meilleurs choix. */
  choix: boolean;
  /** Offre exceptionnelle et sûre : elle déclenche une notification sur l'iPhone. */
  pepite: boolean;
  /** Hors de la zone de retrait, gardée seulement parce que c'est une pépite. */
  loin: boolean;
}

export type Surete = "sûr" | "à vérifier" | "méfiance";
