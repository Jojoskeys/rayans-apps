// Tests (version de test seulement) : lecture du temps visé, passage des 5 km interpolé, avance / retard.
import Toybox.Activity;
import Toybox.Lang;
import Toybox.Test;

(:test)
function tempsLu(logger as Test.Logger) as Boolean {
    // Textes : equals (== compare les objets en Monkey C).
    return lireTemps("29:30") == 1770.0 && lireTemps("1:02:03") == 3723.0 && lireTemps("abc") == null
        && virgule("2.65").equals("2,65") && virgule("3").equals("3")
        && chrono(1770.0).equals("29:30") && ecartTexte(-8.0).equals("-0:08") && ecartTexte(12.0).equals("+0:12");
}

// Course régulière à 5:50/km (350 s/km), mesures toutes les 3 s : 5 km en 29:10 exactement.
(:test)
function passage5kmInterpole(logger as Test.Logger) as Boolean {
    var v = new Champ5kmVue();
    v.cible = 1800.0;
    v.alertes = false;
    var info = new Activity.Info();
    for (var t = 0; t <= 1800; t += 3) {
        info.timerTime = t * 1000;
        info.elapsedDistance = t.toFloat() * 1000.0 / 350.0;
        v.compute(info);
        if (t == 1050) {
            // 3 km en 17:30 alors que l'objectif à 3 km est 18:00 : 30 s d'avance.
            var ecart = v.cible * v.distance / 5000.0 - v.temps;
            logger.debug("avance à 3 km : " + ecart);
            if ((ecart - 30.0).abs() > 0.5) { return false; }
        }
    }
    logger.debug("5 km en " + v.temps5km + " s, kilomètres vus : " + v.dernierKm);
    return v.temps5km != null && ((v.temps5km as Float) - 1750.0).abs() < 0.5 && v.dernierKm == 5;
}
