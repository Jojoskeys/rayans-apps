// Tests du compteur sur des mouvements simulés (25 mesures/s) : inclinaison de l'avant-bras qui oscille,
// plus du bruit. Seulement dans la version de test.
import Toybox.Lang;
import Toybox.Math;
import Toybox.Test;
import Toybox.Application;

// reps répétitions de « periode » secondes, amplitude en milli-g sur l'axe y, bruit ± bruit milli-g,
// avec 2 s d'immobilité avant et après. (Pas d'annotation : une fonction (:test) doit être un test.)
function simuler(c as Compteur, reps as Number, periode as Float, amplitude as Float, bruit as Number) as Number {
    Math.srand(42);
    var n = (reps * periode * 25.0).toNumber();
    for (var i = 0; i < 50 + n + 50; i++) {
        var phase = 0.0;
        if (i >= 50 && i < 50 + n) {
            // 1 - cos : part du repos (bras tendu), monte, revient au repos à chaque répétition.
            phase = amplitude * (1.0 - Math.cos(2.0 * Math.PI * (i - 50) / (periode * 25.0))) / 2.0;
        }
        var b = bruit > 0 ? (Math.rand() % (2 * bruit + 1)) - bruit : 0;
        var y = (300.0 + phase).toNumber() + b;
        c.mesure(20 + b / 2, y, -950 - b / 3);
    }
    return c.reps;
}

(:test)
function tractionsComptees(logger as Test.Logger) as Boolean {
    var c = new Compteur(30.0, 1.0);
    var r = simuler(c, 7, 2.5, 300.0, 15);
    logger.debug("tractions : " + r + " / 7");
    return r == 7;
}

(:test)
function pompesComptees(logger as Test.Logger) as Boolean {
    var c = new Compteur(30.0, 0.6);
    var r = simuler(c, 15, 1.4, 200.0, 15);
    logger.debug("pompes : " + r + " / 15");
    return r == 15;
}

// Petit mouvement (avant-bras qui s'incline peu) et plus de bruit.
(:test)
function pompesFaiblesComptees(logger as Test.Logger) as Boolean {
    var c = new Compteur(30.0, 0.6);
    var r = simuler(c, 12, 1.2, 110.0, 30);
    logger.debug("pompes faibles : " + r + " / 12");
    return r >= 11 && r <= 12;
}

(:test)
function immobileRienCompte(logger as Test.Logger) as Boolean {
    var c = new Compteur(30.0, 1.0);
    var r = simuler(c, 0, 2.5, 0.0, 25);
    logger.debug("immobile : " + r);
    return r == 0;
}

// Sensibilité haute (18 mg) : un poignet immobile avec du bruit ne doit toujours rien compter.
(:test)
function immobileSensibiliteHaute(logger as Test.Logger) as Boolean {
    var c = new Compteur(18.0, 0.6);
    var r = simuler(c, 0, 1.0, 0.0, 30);
    logger.debug("immobile, sensibilité haute : " + r);
    return r == 0;
}
// Déroulé d'une séance comme une course : série → pause → série → fin ; totaux du jour et de toujours.
(:test)
function deroulementSeance(logger as Test.Logger) as Boolean {
    Application.Storage.clearValues();
    var s = new Seance(EX_POMPES);
    s.demarrer();
    if (s.etat != ETAT_SERIE) { logger.error("pas en série au départ"); return false; }
    s.compteur.reps = 12;
    s.basculer();                          // START : pause
    if (s.etat != ETAT_REPOS || s.series.size() != 1 || s.series[0] != 12) { logger.error("pause"); return false; }
    s.corriger(1);                         // correction pendant la pause : 13
    s.basculer();                          // START : série 2
    s.compteur.reps = 10;
    if (s.total() != 23) { logger.error("total en cours " + s.total()); return false; }
    s.terminer(true);                      // série en cours comptée
    logger.debug("séries " + s.series.toString() + " total " + s.total());
    var ok = s.etat == ETAT_FIN && s.series.size() == 2 && s.series[0] == 13 && s.series[1] == 10 && s.total() == 23
        && Totaux.toujours("pompes") == 23 && Totaux.aujourdhui("pompes") == 23 && Totaux.toujours("tractions") == 0;
    // Deuxième séance : les totaux s'additionnent ; une série vide en cours n'est pas comptée.
    var s2 = new Seance(EX_POMPES);
    s2.demarrer();
    s2.compteur.reps = 7;
    s2.basculer();
    s2.basculer();
    s2.terminer(true);
    logger.debug("séance 2 : " + s2.series.toString() + ", toujours " + Totaux.toujours("pompes"));
    return ok && s2.series.size() == 1 && Totaux.toujours("pompes") == 30 && Totaux.aujourdhui("pompes") == 30;
}