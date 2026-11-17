// Comptage des répétitions avec l'accéléromètre du poignet (25 mesures par seconde).
//
// Aux tractions comme aux pompes, la main reste fixe (barre, sol) : la montre ne se déplace presque pas, mais
// l'avant-bras s'incline à chaque répétition, donc la direction de la pesanteur vue par la montre oscille.
// On suit cette oscillation :
//   1. filtre passe-bas sur chaque axe (enlève les secousses) ;
//   2. enveloppe haute et basse de chaque axe, qui se resserrent lentement (~4 s) : le milieu est la
//      position moyenne, la demi-largeur est l'amplitude du mouvement ;
//   3. on garde l'axe qui a la plus grande amplitude ;
//   4. une répétition = passage au-dessus de milieu + 30 % de l'amplitude puis en dessous de milieu − 30 %
//      (hystérésis), avec une amplitude minimale (sensibilité) et un temps minimum entre deux répétitions.
// C'est approximatif par nature : les boutons HAUT / BAS corrigent le compte.
import Toybox.Lang;

class Compteur {

    var reps as Number = 0;
    var seuilMin as Float;          // demi-amplitude minimale, milli-g
    var intervalleMin as Number;    // nombre de mesures minimum entre deux répétitions
    var lp as Array<Float> = [0.0, 0.0, 0.0] as Array<Float>;
    var haut as Array<Float> = [0.0, 0.0, 0.0] as Array<Float>;
    var bas as Array<Float> = [0.0, 0.0, 0.0] as Array<Float>;
    var axe as Number = 0;
    var phaseHaute as Boolean = false;
    var depuisDerniere as Number = 0;
    var mesures as Number = 0;

    // seuil : sensibilité en milli-g ; intervalleMinS : secondes minimum entre deux répétitions.
    function initialize(seuil as Float, intervalleMinS as Float) {
        seuilMin = seuil;
        intervalleMin = (intervalleMinS * 25.0).toNumber();
    }

    function remettreAZero() as Void {
        reps = 0;
        mesures = 0;
        phaseHaute = false;
        depuisDerniere = intervalleMin;
    }

    function amplitude(k as Number) as Float {
        return (haut[k] - bas[k]) / 2.0;
    }

    // Une mesure (milli-g sur x, y, z). Renvoie true quand une répétition vient d'être comptée.
    function mesure(x as Number, y as Number, z as Number) as Boolean {
        var v = [x.toFloat(), y.toFloat(), z.toFloat()];
        mesures++;
        depuisDerniere++;
        if (mesures == 1) {
            for (var k = 0; k < 3; k++) { lp[k] = v[k]; haut[k] = v[k]; bas[k] = v[k]; }
            return false;
        }
        for (var k = 0; k < 3; k++) {
            var l = lp[k] + 0.3 * (v[k] - lp[k]);
            lp[k] = l;
            haut[k] = l > haut[k] ? l : haut[k] - (haut[k] - l) / 100.0;
            bas[k] = l < bas[k] ? l : bas[k] + (l - bas[k]) / 100.0;
        }
        // Changement d'axe seulement s'il bouge nettement plus (évite de sauter d'un axe à l'autre).
        for (var k = 0; k < 3; k++) {
            if (k != axe && amplitude(k) > amplitude(axe) * 1.5) { axe = k; phaseHaute = false; }
        }
        if (mesures < 10) { return false; }

        var a = amplitude(axe);
        var s = lp[axe] - (haut[axe] + bas[axe]) / 2.0;
        var seuil = 0.3 * a;
        if (seuil < seuilMin * 0.3) { seuil = seuilMin * 0.3; }

        if (!phaseHaute) {
            if (s > seuil) { phaseHaute = true; }
        } else if (s < -seuil) {
            phaseHaute = false;
            if (depuisDerniere >= intervalleMin && a >= seuilMin) {
                reps++;
                depuisDerniere = 0;
                return true;
            }
        }
        return false;
    }
}
