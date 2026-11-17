// Cadran : heure, date, prochaine prière (heure et temps restant), anneau qui se remplit entre la prière
// précédente et la suivante, pas, cœur et batterie. Écran toujours allumé : affichage minimal qui se décale
// chaque minute (protection de l'écran AMOLED).
import Toybox.Activity;
import Toybox.ActivityMonitor;
import Toybox.Application;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
import Toybox.System;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.WatchUi;
import Toybox.Weather;

const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const C_ACCENT = 0xFFB300;   // ambre : prochaine prière
const C_ANNEAU = 0x2E7D32;   // vert : avancée vers la prochaine prière
const C_FOND_ANNEAU = 0x222222;
const C_GRIS = 0xAAAAAA;

// Rennes, tant que la montre n'a jamais eu de position GPS.
const LAT_DEFAUT = 48.1173d;
const LNG_DEFAUT = -1.6778d;

class CadranVue extends WatchUi.WatchFace {

    var enVeille as Boolean = false;
    // Cache des horaires : recalculés au changement de jour, de position ou de réglage.
    var cleCache as String = "";
    var hier as Array<Number> = [] as Array<Number>;
    var aujourdhui as Array<Number> = [] as Array<Number>;
    var demain as Array<Number> = [] as Array<Number>;

    function initialize() {
        WatchFace.initialize();
    }

    function reinitialiser() as Void {
        cleCache = "";
    }

    function onExitSleep() as Void {
        enVeille = false;
        WatchUi.requestUpdate();
    }

    function onEnterSleep() as Void {
        enVeille = true;
        WatchUi.requestUpdate();
    }

    // ----- Réglages et position ---------------------------------------------------------------------------

    function reglageNombre(cle as String, defaut as Number) as Number {
        var v = Application.Properties.getValue(cle);
        return v instanceof Number ? v : defaut;
    }

    function reglageDecimal(cle as String, defaut as Double) as Double {
        var v = Application.Properties.getValue(cle);
        if (v instanceof Float || v instanceof Double || v instanceof Number) { return (v as Numeric).toDouble(); }
        return defaut;
    }

    function reglageBooleen(cle as String, defaut as Boolean) as Boolean {
        var v = Application.Properties.getValue(cle);
        return v instanceof Boolean ? v : defaut;
    }

    // Position : réglage manuel, sinon dernière position connue de la montre (GPS d'une activité, météo),
    // gardée dans le stockage de l'app ; sinon Rennes.
    function position() as Array<Double> {
        if (reglageBooleen("positionManuelle", false)) {
            return [reglageDecimal("latitude", LAT_DEFAUT), reglageDecimal("longitude", LNG_DEFAUT)];
        }
        var loc = null;
        var info = Activity.getActivityInfo();
        if (info != null && info.currentLocation != null) { loc = info.currentLocation; }
        if (loc == null && (Toybox has :Weather)) {
            var meteo = Weather.getCurrentConditions();
            if (meteo != null && meteo.observationLocationPosition != null) { loc = meteo.observationLocationPosition; }
        }
        if (loc != null) {
            var d = loc.toDegrees();
            var lat = (d[0] as Numeric).toDouble();
            var lng = (d[1] as Numeric).toDouble();
            if (lat.abs() <= 90.0d && lng.abs() <= 180.0d && !(lat == 0.0d && lng == 0.0d)) {
                // Arrondi au centième de degré (environ 1 km) : assez pour les horaires.
                lat = Math.round(lat * 100.0d).toDouble() / 100.0d;
                lng = Math.round(lng * 100.0d).toDouble() / 100.0d;
                Application.Storage.setValue("position", [lat.toFloat(), lng.toFloat()]);
                return [lat, lng];
            }
        }
        var garde = Application.Storage.getValue("position");
        if (garde instanceof Array && garde.size() == 2) {
            return [(garde[0] as Numeric).toDouble(), (garde[1] as Numeric).toDouble()];
        }
        return [LAT_DEFAUT, LNG_DEFAUT];
    }

    function jourUnix(t as Time.Moment) as Number {
        var g = Gregorian.info(t, Time.FORMAT_SHORT);
        var m = Gregorian.moment({ :year => g.year, :month => g.month, :day => g.day, :hour => 0, :minute => 0, :second => 0 });
        return (m.value() / 86400).toNumber();
    }

    function preparerHoraires() as Void {
        var pos = position();
        var n = jourUnix(Time.now());
        var tz = System.getClockTime().timeZoneOffset.toDouble() / 3600.0d;
        var methode = reglageNombre("methode", 0);
        var hanafi = reglageNombre("ecoleAsr", 0) == 1;
        var decalage = reglageNombre("decalage", 0);
        var cle = n.toString() + "|" + pos[0].toString() + "|" + pos[1].toString() + "|" + tz.toString() + "|" + methode + "|" + hanafi + "|" + decalage;
        if (cle.equals(cleCache)) { return; }
        cleCache = cle;
        hier = decaler(Priere.jour(pos[0], pos[1], tz, n - 1, methode, hanafi), decalage);
        aujourdhui = decaler(Priere.jour(pos[0], pos[1], tz, n, methode, hanafi), decalage);
        demain = decaler(Priere.jour(pos[0], pos[1], tz, n + 1, methode, hanafi), decalage);
    }

    // Décalage commun en minutes (pour coller au calendrier de sa mosquée), sauf Chourouq.
    function decaler(h as Array<Number>, d as Number) as Array<Number> {
        if (d == 0) { return h; }
        for (var i = 0; i < h.size(); i++) {
            if (i != 1 && h[i] > -100000) { h[i] = h[i] + d; }
        }
        return h;
    }

    // [index, minute de début de l'intervalle, minute de l'événement suivant] relatifs à aujourd'hui 0 h.
    // Chourouq compte comme événement : c'est la fin du temps de Fajr.
    function prochaine(maintenant as Number) as Array<Number> {
        var precedente = hier[5] - 1440;
        for (var i = 0; i < 6; i++) {
            var h = aujourdhui[i];
            if (h <= -100000) { continue; }
            if (h > maintenant) { return [i, precedente, h]; }
            precedente = h;
        }
        return [0, precedente, demain[0] + 1440];
    }

    // ----- Dessin -----------------------------------------------------------------------------------------

    function hhmm(minutes as Number) as String {
        var m = ((minutes % 1440) + 1440) % 1440;
        return (m / 60).format("%d") + ":" + (m % 60).format("%02d");
    }

    function duree(minutes as Number) as String {
        if (minutes < 60) { return minutes.format("%d") + " min"; }
        return (minutes / 60).format("%d") + " h " + (minutes % 60).format("%02d");
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        preparerHoraires();
        var horloge = System.getClockTime();
        var maintenant = horloge.hour * 60 + horloge.min;
        var p = prochaine(maintenant);
        var nom = Priere.NOMS[p[0]] as String;
        var reste = p[2] - maintenant;

        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        var cy = h / 2;
        if (dc has :setAntiAlias) { dc.setAntiAlias(true); }
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var heure = horloge.hour.format("%02d") + ":" + horloge.min.format("%02d");
        var reglages = System.getDeviceSettings();

        if (enVeille && reglages.requiresBurnInProtection) {
            // Écran toujours allumé : peu de pixels, gris, et position qui bouge chaque minute.
            var dx = ((horloge.min % 5) - 2) * 6;
            var dy = (((horloge.min / 5) % 5) - 2) * 6;
            dc.setColor(0x777777, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx + dx, cy - 30 + dy, Graphics.FONT_NUMBER_MEDIUM, heure, Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
            dc.setColor(0x996B00, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx + dx, cy + 45 + dy, Graphics.FONT_TINY, nom + " " + hhmm(p[2]), Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
            return;
        }

        // Anneau : part écoulée entre la prière précédente et la prochaine.
        var rayon = cx - 8;
        dc.setPenWidth(10);
        dc.setColor(C_FOND_ANNEAU, Graphics.COLOR_TRANSPARENT);
        dc.drawCircle(cx, cy, rayon);
        var total = p[2] - p[1];
        if (total > 0) {
            var frac = (maintenant - p[1]).toFloat() / total.toFloat();
            if (frac > 0.0) {
                if (frac > 1.0) { frac = 1.0; }
                var fin = 90 - (frac * 360.0).toNumber();
                dc.setColor(reste <= 15 ? C_ACCENT : C_ANNEAU, Graphics.COLOR_TRANSPARENT);
                if (frac >= 0.999) { dc.drawCircle(cx, cy, rayon); }
                else { dc.drawArc(cx, cy, rayon, Graphics.ARC_CLOCKWISE, 90, ((fin % 360) + 360) % 360); }
            }
        }
        dc.setPenWidth(1);

        // Date
        var g = Gregorian.info(Time.now(), Time.FORMAT_SHORT);
        var date = (JOURS[(g.day_of_week as Number) - 1] as String) + " " + (g.day as Number).format("%d") + " " + (MOIS[(g.month as Number) - 1] as String);
        dc.setColor(C_GRIS, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - h * 30 / 100, Graphics.FONT_SMALL, date, Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);

        // Heure
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - h * 7 / 100, Graphics.FONT_NUMBER_HOT, heure, Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);

        // Prochaine prière
        dc.setColor(C_ACCENT, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy + h * 15 / 100, Graphics.FONT_MEDIUM, nom + "  " + hhmm(p[2]), Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy + h * 24 / 100, Graphics.FONT_SMALL, "dans " + duree(reste), Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);

        // Pas · cœur · batterie
        dc.setColor(C_GRIS, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy + h * 34 / 100, Graphics.FONT_XTINY, ligneBas(), Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
    }

    function ligneBas() as String {
        var morceaux = [] as Array<String>;
        var am = ActivityMonitor.getInfo();
        if (am != null && am.steps != null) { morceaux.add((am.steps as Number).format("%d") + " pas"); }
        var fc = frequenceCardiaque();
        if (fc != null) { morceaux.add(fc.format("%d") + " bpm"); }
        morceaux.add(System.getSystemStats().battery.format("%d") + " %");
        var s = "";
        for (var i = 0; i < morceaux.size(); i++) {
            s += (i > 0 ? "  ·  " : "") + morceaux[i];
        }
        return s;
    }

    function frequenceCardiaque() as Number? {
        var info = Activity.getActivityInfo();
        if (info != null && info.currentHeartRate != null) { return info.currentHeartRate; }
        if (ActivityMonitor has :getHeartRateHistory) {
            var it = ActivityMonitor.getHeartRateHistory(1, true);
            var e = it.next();
            if (e != null && e.heartRate != null && e.heartRate != ActivityMonitor.INVALID_HR_SAMPLE) { return e.heartRate; }
        }
        return null;
    }
}
