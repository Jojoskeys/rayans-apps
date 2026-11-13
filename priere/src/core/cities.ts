// Villes proposées dans la recherche (coordonnées du centre-ville). Toute autre position se saisit à la main.
export interface City { name: string; country: string; lat: number; lng: number; tz: string }

const FR = "Europe/Paris";
const c = (name: string, country: string, lat: number, lng: number, tz: string): City => ({ name, country, lat, lng, tz });

export const CITIES: City[] = [
  // France
  c("Paris", "France", 48.8566, 2.3522, FR), c("Marseille", "France", 43.2965, 5.3698, FR), c("Lyon", "France", 45.764, 4.8357, FR),
  c("Toulouse", "France", 43.6047, 1.4442, FR), c("Nice", "France", 43.7102, 7.262, FR), c("Nantes", "France", 47.2184, -1.5536, FR),
  c("Montpellier", "France", 43.6108, 3.8767, FR), c("Strasbourg", "France", 48.5734, 7.7521, FR), c("Bordeaux", "France", 44.8378, -0.5792, FR),
  c("Lille", "France", 50.6292, 3.0573, FR), c("Rennes", "France", 48.1173, -1.6778, FR), c("Reims", "France", 49.2583, 4.0317, FR),
  c("Toulon", "France", 43.1242, 5.928, FR), c("Saint-Étienne", "France", 45.4397, 4.3872, FR), c("Le Havre", "France", 49.4944, 0.1079, FR),
  c("Grenoble", "France", 45.1885, 5.7245, FR), c("Dijon", "France", 47.322, 5.0415, FR), c("Angers", "France", 47.4784, -0.5632, FR),
  c("Nîmes", "France", 43.8367, 4.3601, FR), c("Villeurbanne", "France", 45.7719, 4.8902, FR), c("Clermont-Ferrand", "France", 45.7772, 3.087, FR),
  c("Le Mans", "France", 48.0061, 0.1996, FR), c("Aix-en-Provence", "France", 43.5297, 5.4474, FR), c("Brest", "France", 48.3904, -4.4861, FR),
  c("Tours", "France", 47.3941, 0.6848, FR), c("Amiens", "France", 49.8941, 2.2958, FR), c("Limoges", "France", 45.8336, 1.2611, FR),
  c("Annecy", "France", 45.8992, 6.1294, FR), c("Perpignan", "France", 42.6887, 2.8948, FR), c("Metz", "France", 49.1193, 6.1757, FR),
  c("Besançon", "France", 47.2378, 6.0241, FR), c("Orléans", "France", 47.9029, 1.9093, FR), c("Rouen", "France", 49.4432, 1.0999, FR),
  c("Mulhouse", "France", 47.7508, 7.3359, FR), c("Caen", "France", 49.1829, -0.3707, FR), c("Nancy", "France", 48.6921, 6.1844, FR),
  c("Saint-Denis", "France", 48.9362, 2.3574, FR), c("Argenteuil", "France", 48.9472, 2.2467, FR), c("Montreuil", "France", 48.8638, 2.4485, FR),
  c("Roubaix", "France", 50.6942, 3.1746, FR), c("Tourcoing", "France", 50.7239, 3.1612, FR), c("Avignon", "France", 43.9493, 4.8055, FR),
  c("Poitiers", "France", 46.5802, 0.3404, FR), c("Pau", "France", 43.2951, -0.3708, FR), c("La Rochelle", "France", 46.1603, -1.1511, FR),
  c("Créteil", "France", 48.7904, 2.4556, FR), c("Versailles", "France", 48.8049, 2.1204, FR), c("Évry-Courcouronnes", "France", 48.6239, 2.4294, FR),
  c("Cergy", "France", 49.0364, 2.0761, FR), c("Mantes-la-Jolie", "France", 48.9908, 1.7172, FR), c("Valence", "France", 44.9334, 4.8924, FR),
  c("Saint-Denis (La Réunion)", "France", -20.8823, 55.4504, "Indian/Reunion"), c("Mamoudzou (Mayotte)", "France", -12.7806, 45.2279, "Indian/Mayotte"),
  // Belgique, Suisse, Luxembourg
  c("Bruxelles", "Belgique", 50.8503, 4.3517, "Europe/Brussels"), c("Anvers", "Belgique", 51.2194, 4.4025, "Europe/Brussels"),
  c("Liège", "Belgique", 50.6326, 5.5797, "Europe/Brussels"), c("Charleroi", "Belgique", 50.4108, 4.4446, "Europe/Brussels"),
  c("Genève", "Suisse", 46.2044, 6.1432, "Europe/Zurich"), c("Lausanne", "Suisse", 46.5197, 6.6323, "Europe/Zurich"),
  c("Zurich", "Suisse", 47.3769, 8.5417, "Europe/Zurich"), c("Luxembourg", "Luxembourg", 49.6116, 6.1319, "Europe/Luxembourg"),
  // Europe
  c("Londres", "Royaume-Uni", 51.5074, -0.1278, "Europe/London"), c("Birmingham", "Royaume-Uni", 52.4862, -1.8904, "Europe/London"),
  c("Amsterdam", "Pays-Bas", 52.3676, 4.9041, "Europe/Amsterdam"), c("Rotterdam", "Pays-Bas", 51.9244, 4.4777, "Europe/Amsterdam"),
  c("Berlin", "Allemagne", 52.52, 13.405, "Europe/Berlin"), c("Francfort", "Allemagne", 50.1109, 8.6821, "Europe/Berlin"),
  c("Madrid", "Espagne", 40.4168, -3.7038, "Europe/Madrid"), c("Barcelone", "Espagne", 41.3874, 2.1686, "Europe/Madrid"),
  c("Rome", "Italie", 41.9028, 12.4964, "Europe/Rome"), c("Milan", "Italie", 45.4642, 9.19, "Europe/Rome"),
  c("Istanbul", "Turquie", 41.0082, 28.9784, "Europe/Istanbul"), c("Sarajevo", "Bosnie-Herzégovine", 43.8563, 18.4131, "Europe/Sarajevo"),
  // Maghreb, Afrique
  c("Casablanca", "Maroc", 33.5731, -7.5898, "Africa/Casablanca"), c("Rabat", "Maroc", 34.0209, -6.8416, "Africa/Casablanca"),
  c("Marrakech", "Maroc", 31.6295, -7.9811, "Africa/Casablanca"), c("Fès", "Maroc", 34.0181, -5.0078, "Africa/Casablanca"),
  c("Tanger", "Maroc", 35.7595, -5.834, "Africa/Casablanca"), c("Oujda", "Maroc", 34.6814, -1.9086, "Africa/Casablanca"),
  c("Alger", "Algérie", 36.7538, 3.0588, "Africa/Algiers"), c("Oran", "Algérie", 35.6971, -0.6308, "Africa/Algiers"),
  c("Constantine", "Algérie", 36.365, 6.6147, "Africa/Algiers"), c("Tlemcen", "Algérie", 34.8828, -1.3167, "Africa/Algiers"),
  c("Tunis", "Tunisie", 36.8065, 10.1815, "Africa/Tunis"), c("Sfax", "Tunisie", 34.7406, 10.7603, "Africa/Tunis"),
  c("Dakar", "Sénégal", 14.7167, -17.4677, "Africa/Dakar"), c("Bamako", "Mali", 12.6392, -8.0029, "Africa/Bamako"),
  c("Abidjan", "Côte d'Ivoire", 5.36, -4.0083, "Africa/Abidjan"), c("Le Caire", "Égypte", 30.0444, 31.2357, "Africa/Cairo"),
  c("Nouakchott", "Mauritanie", 18.0735, -15.9582, "Africa/Nouakchott"), c("Niamey", "Niger", 13.5116, 2.1254, "Africa/Niamey"),
  c("Moroni", "Comores", -11.7172, 43.2473, "Indian/Comoro"),
  // Moyen-Orient, Asie
  c("La Mecque", "Arabie saoudite", 21.4225, 39.8262, "Asia/Riyadh"), c("Médine", "Arabie saoudite", 24.4672, 39.6111, "Asia/Riyadh"),
  c("Riyad", "Arabie saoudite", 24.7136, 46.6753, "Asia/Riyadh"), c("Dubaï", "Émirats arabes unis", 25.2048, 55.2708, "Asia/Dubai"),
  c("Doha", "Qatar", 25.2854, 51.531, "Asia/Qatar"), c("Amman", "Jordanie", 31.9454, 35.9284, "Asia/Amman"),
  c("Jérusalem", "Palestine", 31.7683, 35.2137, "Asia/Jerusalem"), c("Beyrouth", "Liban", 33.8938, 35.5018, "Asia/Beirut"),
  c("Karachi", "Pakistan", 24.8607, 67.0011, "Asia/Karachi"), c("Kuala Lumpur", "Malaisie", 3.139, 101.6869, "Asia/Kuala_Lumpur"),
  c("Jakarta", "Indonésie", -6.2088, 106.8456, "Asia/Jakarta"),
  // Amérique
  c("Montréal", "Canada", 45.5019, -73.5674, "America/Toronto"), c("Québec", "Canada", 46.8139, -71.208, "America/Toronto"),
  c("Ottawa", "Canada", 45.4215, -75.6972, "America/Toronto"), c("Toronto", "Canada", 43.6532, -79.3832, "America/Toronto"),
  c("New York", "États-Unis", 40.7128, -74.006, "America/New_York"),
];

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function searchCities(q: string, limit = 8): City[] {
  const f = fold(q);
  if (!f) return [];
  const starts = CITIES.filter((x) => fold(x.name).startsWith(f));
  const contains = CITIES.filter((x) => !starts.includes(x) && (fold(x.name).includes(f) || fold(x.country).startsWith(f)));
  return [...starts, ...contains].slice(0, limit);
}
