// Tests (seulement dans la version de test : construire.ps1 -Tests). Valeurs attendues calculées avec le
// code de Rayan's Prière (priere/src/core/praytimes.ts), en minutes depuis minuit local.
import Toybox.Lang;
import Toybox.Test;
import Toybox.Application;
import Toybox.Time;

(:test)
function horairesCommePriere(logger as Test.Logger) as Boolean {
    var cas = [
        [48.1173d, -1.6778d, 1.0d, 20774, 0, false, [424, 496, 772, 905, 1046, 1119], "Rennes 17/11/2026"],
        [48.1173d, -1.6778d, 2.0d, 20625, 0, false, [271, 367, 849, 1104, 1330, 1426], "Rennes 21/06/2026"],
        [48.8566d, 2.3522d, 1.0d, 20513, 2, true, [348, 453, 783, 1004, 1114, 1213], "Paris MWL hanafite 01/03/2026"],
        [21.4225d, 39.8262d, 3.0d, 20774, 5, false, [313, 393, 726, 916, 1058, 1148], "La Mecque 17/11/2026"]
    ];
    var ok = true;
    for (var i = 0; i < cas.size(); i++) {
        var c = cas[i] as Array;
        var obtenu = Priere.jour(c[0] as Double, c[1] as Double, c[2] as Double, c[3] as Number, c[4] as Number, c[5] as Boolean);
        var attendu = c[6] as Array<Number>;
        for (var k = 0; k < 6; k++) {
            if (obtenu[k] != attendu[k]) {
                logger.error(c[7] + " " + Priere.NOMS[k] + " : " + obtenu[k] + " au lieu de " + attendu[k]);
                ok = false;
            }
        }
    }
    return ok;
}

// Alertes : 5 prières par jour sur deux jours, dans l'ordre ; la prochaine est dans le futur ; coupées → aucune.
(:test)
function alertesDePriere(logger as Test.Logger) as Boolean {
    Application.Properties.setValue("alertes", true);
    Application.Properties.setValue("alerteAvance", 0);
    var a = Planif.alertes();
    var ok = a.size() == 10;
    for (var i = 1; i < a.size(); i++) { if (a[i][0] <= a[i - 1][0]) { ok = false; } }
    var p = Planif.prochaine();
    ok = ok && p != null && (p as Array<Number>)[0] > Time.now().value() && (p as Array<Number>)[1] != 1;
    Application.Properties.setValue("alerteAvance", 10);
    var b = Planif.alertes();
    ok = ok && b[0][0] == a[0][0] - 600;
    Application.Properties.setValue("alertes", false);
    ok = ok && Planif.prochaine() == null;
    Application.Properties.setValue("alertes", true);
    Application.Properties.setValue("alerteAvance", 0);
    logger.debug("prochaine alerte : " + Priere.NOMS[(p as Array<Number>)[1]] + " " + Planif.hhmm((p as Array<Number>)[2]));
    return ok;
}