// Champ de course « objectif 5 km » : avance ou retard sur le temps visé, temps final estimé à l'allure
// moyenne, distance restante. À chaque kilomètre, une alerte donne le temps du kilomètre et l'écart.
// Après 5 km : le temps réel sur 5 km (interpolé entre deux mesures).
import Toybox.Activity;
import Toybox.Application;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
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

// « 2.65 » -> « 2,65 »
function virgule(s as String) as String {
    var i = s.find(".");
    return i == null ? s : (s.substring(0, i) as String) + "," + (s.substring(i + 1, s.length()) as String);
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
    var dureeDernierKm as Float = 0.0;
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
        distance = 0.0; temps = 0.0; dernierKm = 0; dureeDernierKm = 0.0; tempsDernierKm = 0.0; temps5km = null;
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
            dureeDernierKm = tempsKm;
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
            detail = "fin " + chrono(estime) + " · reste " + virgule(reste.format("%.2f"));
        }

        if (petit) {
            dc.setColor(gris, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, cy - h * 28 / 100, Graphics.FONT_XTINY, titre, centre);
            dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, cy + h * 10 / 100, Graphics.FONT_NUMBER_MILD, valeur, centre);
            return;
        }
        if (w >= 300 && h >= 300) {
            pleinEcran(dc, w, h, titre, valeur, couleur, texte, gris);
            return;
        }
        dc.setColor(gris, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - h * 30 / 100, Graphics.FONT_SMALL, titre, centre);
        dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy, Graphics.FONT_NUMBER_HOT, valeur, centre);
        dc.setColor(texte, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy + h * 30 / 100, Graphics.FONT_SMALL, detail, centre);
    }

    // ----- Écran entier : anneau de distance (couleur de l'écart) et repère du temps visé ----------------------

    var fTitre as Graphics.FontType?;
    var fValeur as Graphics.FontType?;
    var fDetail as Graphics.FontType?;
    var fPetit as Graphics.FontType?;

    function police(px as Number, gras as Boolean, defaut as Graphics.FontType) as Graphics.FontType {
        if (Graphics has :getVectorFont) {
            var f = Graphics.getVectorFont({ :face => gras ? ["RobotoCondensedBold", "RobotoRegular"] : ["RobotoCondensedRegular", "RobotoRegular"], :size => px });
            if (f != null) { return f; }
        }
        return defaut;
    }

    function pleinEcran(dc as Graphics.Dc, w as Number, h as Number, titre as String, valeur as String,
                        couleur as Number, texte as Number, gris as Number) as Void {
        if (fTitre == null) {
            fTitre = police(h * 7 / 100, true, Graphics.FONT_SMALL);
            fValeur = police(h * 27 / 100, true, Graphics.FONT_NUMBER_HOT);
            fDetail = police(h * 8 / 100, false, Graphics.FONT_SMALL);
            fPetit = police(h * 6 / 100, false, Graphics.FONT_TINY);
        }
        var cx = w / 2;
        var cy = h / 2;
        var r = (w < h ? w : h) / 2 - 10;
        var centre = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        if (dc has :setAntiAlias) { dc.setAntiAlias(true); }

        // Anneau : distance parcourue sur 5 km.
        var frac = distance / DISTANCE;
        if (frac > 1.0) { frac = 1.0; }
        dc.setPenWidth(12);
        dc.setColor(texte == Graphics.COLOR_WHITE ? 0x1E1E1E : 0xDDDDDD, Graphics.COLOR_TRANSPARENT);
        dc.drawCircle(cx, cy, r);
        if (frac > 0.0) {
            dc.setColor(distance < 200.0 ? gris : couleur, Graphics.COLOR_TRANSPARENT);
            if (frac >= 0.999) { dc.drawCircle(cx, cy, r); }
            else {
                var fin = 90 - (frac * 360.0).toNumber();
                dc.drawArc(cx, cy, r, Graphics.ARC_CLOCKWISE, 90, ((fin % 360) + 360) % 360);
            }
        }
        // Repère : où il faudrait être à ce temps-ci pour tenir l'objectif.
        if (temps5km == null && temps > 0.0) {
            var fc = temps / cible;
            if (fc > 1.0) { fc = 1.0; }
            var a = Math.toRadians(90.0 - fc * 360.0);
            var r1 = r - 14;
            var r2 = r + 8;
            dc.setPenWidth(4);
            dc.setColor(texte, Graphics.COLOR_TRANSPARENT);
            dc.drawLine(cx + r1 * Math.cos(a), cy - r1 * Math.sin(a), cx + r2 * Math.cos(a), cy - r2 * Math.sin(a));
        }
        dc.setPenWidth(1);

        dc.setColor(gris, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 20 / 100, fTitre as Graphics.FontType, titre.toUpper(), centre);
        dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 42 / 100, fValeur as Graphics.FontType, valeur, centre);

        var l1;
        var l2;
        if (temps5km != null) {
            l1 = "objectif " + chrono(cible);
            l2 = "allure " + chrono((temps5km as Float) / 5.0) + " /km";
        } else if (distance < 200.0) {
            l1 = chrono(cible / 5.0) + " /km";
            l2 = "START pour partir";
        } else {
            l1 = "fin estimée " + chrono(temps * DISTANCE / distance);
            l2 = "reste " + virgule(((DISTANCE - distance) / 1000.0).format("%.2f")) + " km";
        }
        dc.setColor(texte, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 62 / 100, fDetail as Graphics.FontType, l1, centre);
        dc.setColor(gris, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 72 / 100, fPetit as Graphics.FontType, l2, centre);
        if (dernierKm > 0 && temps5km == null) {
            dc.drawText(cx, h * 82 / 100, fPetit as Graphics.FontType, "km " + dernierKm + " en " + chrono(dureeDernierKm), centre);
        }
    }
}