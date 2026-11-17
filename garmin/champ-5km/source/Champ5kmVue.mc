// Champ de course « objectif 5 km » : avance ou retard sur le temps visé, temps final estimé à l'allure
// moyenne, distance restante. À chaque kilomètre, une alerte donne le temps du kilomètre et l'écart.
// Après 5 km : le temps réel sur 5 km (interpolé entre deux mesures).
import Toybox.Activity;
import Toybox.Application;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

const DISTANCE = 5000.0;
const C_AVANCE = 0x00C853;
const C_RETARD = 0xFF3D00;

// Temps au format « 29:30 » ou « 1:02:03 ».
function chrono(secondes as Float) as String {
    var s = secondes.abs().toNumber();
    if (s >= 3600) { return (s / 3600).format("%d") + ":" + ((s % 3600) / 60).format("%02d") + ":" + (s % 60).format("%02d"); }
    return (s / 60).format("%d") + ":" + (s % 60).format("%02d");
}

// Écart signé : « +0:12 » (avance) ou « −0:08 » (retard).
function ecartTexte(ecart as Float) as String {
    var signe = ecart >= 0.0 ? "+" : "-";
    return signe + chrono(ecart);
}

// « 29:30 » -> 1770 ; texte illisible -> null.
function lireTemps(texte as String) as Float? {
    var morceaux = [] as Array<String>;
    var reste = texte;
    var i = reste.find(":");
    while (i != null) {
        morceaux.add(reste.substring(0, i) as String);
        reste = reste.substring(i + 1, reste.length()) as String;
        i = reste.find(":");
    }
    morceaux.add(reste);
    var total = 0;
    for (var k = 0; k < morceaux.size(); k++) {
        var n = (morceaux[k] as String).toNumber();
        if (n == null || n < 0) { return null; }
        total = total * 60 + n;
    }
    return total > 0 ? total.toFloat() : null;
}

class AlerteKm extends WatchUi.DataFieldAlert {
    var ligne1 as String;
    var ligne2 as String;
    var couleur as Number;

    function initialize(l1 as String, l2 as String, c as Number) {
        DataFieldAlert.initialize();
        ligne1 = l1; ligne2 = l2; couleur = c;
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var cx = dc.getWidth() / 2;
        var cy = dc.getHeight() / 2;
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - 35, Graphics.FONT_MEDIUM, ligne1, Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
        dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy + 25, Graphics.FONT_NUMBER_MEDIUM, ligne2, Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
    }
}

class Champ5kmVue extends WatchUi.DataField {

    var cible as Float = 1800.0;   // temps visé sur 5 km, en secondes
    var alertes as Boolean = true;
    var distance as Float = 0.0;   // mètres
    var temps as Float = 0.0;      // secondes de chrono (pauses exclues)
    var dernierKm as Number = 0;
    var tempsDernierKm as Float = 0.0;
    var temps5km as Float? = null;

    function initialize() {
        DataField.initialize();
        lireReglages();
    }

    function lireReglages() as Void {
        var v = Application.Properties.getValue("objectif");
        var t = v instanceof String ? lireTemps(v) : null;
        cible = t != null ? t : 1800.0;
        var a = Application.Properties.getValue("alertesKm");
        alertes = a instanceof Boolean ? a : true;
    }

    function onTimerReset() as Void {
        distance = 0.0; temps = 0.0; dernierKm = 0; tempsDernierKm = 0.0; temps5km = null;
    }

    function compute(info as Activity.Info) as Void {
        var d = info.elapsedDistance != null ? (info.elapsedDistance as Float) : 0.0;
        var t = info.timerTime != null ? (info.timerTime as Number).toFloat() / 1000.0 : 0.0;
        if (d < distance - 50.0 || t < temps - 5.0) { onTimerReset(); }

        if (temps5km == null && d >= DISTANCE && distance < DISTANCE && d > distance) {
            temps5km = temps + (t - temps) * (DISTANCE - distance) / (d - distance);
        }

        var km = (d / 1000.0).toNumber();
        if (km > dernierKm && km <= 5 && d > distance) {
            // Instant de passage interpolé.
            var passage = temps + (t - temps) * (km * 1000.0 - distance) / (d - distance);
            var tempsKm = passage - tempsDernierKm;
            var ecart = cible * km / 5.0 - passage;
            dernierKm = km;
            tempsDernierKm = passage;
            if (alertes && (WatchUi.DataField has :showAlert)) {
                WatchUi.DataField.showAlert(new AlerteKm("Km " + km + " : " + chrono(tempsKm), ecartTexte(ecart), ecart >= 0.0 ? C_AVANCE : C_RETARD));
            }
        }
        distance = d;
        temps = t;
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var fond = getBackgroundColor();
        var texte = fond == Graphics.COLOR_BLACK ? Graphics.COLOR_WHITE : Graphics.COLOR_BLACK;
        var gris = fond == Graphics.COLOR_BLACK ? 0xAAAAAA : 0x555555;
        dc.setColor(texte, fond);
        dc.clear();
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        var cy = h / 2;
        var petit = h < 120;
        var centre = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;

        var titre;
        var valeur;
        var detail;
        var couleur = texte;
        if (temps5km != null) {
            var ecart = cible - temps5km;
            titre = "5 km en";
            valeur = chrono(temps5km);
            detail = ecartTexte(ecart) + " sur " + chrono(cible);
            couleur = ecart >= 0.0 ? C_AVANCE : C_RETARD;
        } else if (distance < 200.0) {
            titre = "Objectif 5 km";
            valeur = chrono(cible);
            detail = chrono(cible / 5.0) + " /km";
        } else {
            var ecart = cible * distance / DISTANCE - temps;
            var estime = temps * DISTANCE / distance;
            titre = ecart >= 0.0 ? "Avance" : "Retard";
            valeur = ecartTexte(ecart);
            couleur = ecart >= 0.0 ? C_AVANCE : C_RETARD;
            var reste = (DISTANCE - distance) / 1000.0;
            detail = "fin " + chrono(estime) + " · reste " + reste.format("%.2f");
        }

        if (petit) {
            dc.setColor(gris, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, cy - h * 28 / 100, Graphics.FONT_XTINY, titre, centre);
            dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, cy + h * 10 / 100, Graphics.FONT_NUMBER_MILD, valeur, centre);
            return;
        }
        dc.setColor(gris, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - h * 30 / 100, Graphics.FONT_SMALL, titre, centre);
        dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy, Graphics.FONT_NUMBER_HOT, valeur, centre);
        dc.setColor(texte, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy + h * 30 / 100, Graphics.FONT_SMALL, detail, centre);
    }
}
