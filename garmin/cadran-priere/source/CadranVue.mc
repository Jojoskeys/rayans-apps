// Cadran « soleil » : anneau de 24 heures (midi en haut, minuit en bas) coloré selon la lumière du jour — nuit,
// aube (Fajr → lever), jour, crépuscule (Maghrib → Isha) — avec un repère par prière et un point pour l'heure
// actuelle. Au centre : date, heure, prochaine prière et temps restant ; en bas : pas, cœur, batterie.
// Écran toujours allumé : heure et prochaine prière seulement, en gris, et décalées chaque minute (AMOLED).
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

const JOURS = ["DIMANCHE", "LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"];
const MOIS = ["JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE"];
const NOMS_MAJ = ["FAJR", "CHOUROUQ", "DHUHR", "ASR", "MAGHRIB", "ISHA"];

// Palette : or pour la prière qui vient, couleurs sourdes pour l'anneau (l'heure reste ce qui ressort).
const C_OR = 0xF2B544;
const C_GRIS = 0x8C8C8C;
const C_GRIS_FONCE = 0x3A3A3A;
const C_NUIT = 0x1B2357;
const C_AUBE = 0x4A3F95;
const C_JOUR = 0x7A5A12;
const C_CREPUSCULE = 0x6A2C63;
const C_PAS = 0x4DD0C8;
const C_COEUR = 0xFF5A5F;

// Rennes, tant que la montre n'a jamais eu de position GPS.
const LAT_DEFAUT = 48.1173d;
const LNG_DEFAUT = -1.6778d;

class CadranVue extends WatchUi.WatchFace {

    var enVeille as Boolean = false;
    var programmerAlerte as Boolean = true;
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
        programmerAlerte = true;
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

    var fHeure as Graphics.FontType?;
    var fHeureVeille as Graphics.FontType?;
    var fDate as Graphics.FontType?;
    var fPriere as Graphics.FontType?;
    var fPriereFine as Graphics.FontType?;
    var fPetit as Graphics.FontType?;

    function onLayout(dc as Graphics.Dc) as Void {
        var h = dc.getHeight();
        fHeure = Dessin.police(h * 33 / 100, true);
        fHeureVeille = Dessin.police(h * 24 / 100, false);
        fDate = Dessin.police(h * 6 / 100, false);
        fPriere = Dessin.police(h * 9 / 100, true);
        fPriereFine = Dessin.police(h * 9 / 100, false);
        fPetit = Dessin.police(h * 6 / 100, false);
    }

    function hhmm(minutes as Number) as String {
        var m = ((minutes % 1440) + 1440) % 1440;
        return (m / 60).format("%d") + ":" + (m % 60).format("%02d");
    }

    function duree(minutes as Number) as String {
        if (minutes < 60) { return minutes.format("%d") + " min"; }
        return (minutes / 60).format("%d") + " h " + (minutes % 60).format("%02d");
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        if (fHeure == null) { onLayout(dc); }
        preparerHoraires();
        var horloge = System.getClockTime();
        // Réveil de l'alerte de prière : vérifié au changement d'horaires et toutes les 10 minutes.
        if (programmerAlerte || horloge.min % 10 == 0) {
            programmerAlerte = false;
            Planif.programmer();
        }
        var maintenant = horloge.hour * 60 + horloge.min;
        var p = prochaine(maintenant);
        var reste = p[2] - maintenant;

        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        var cy = h / 2;
        if (dc has :setAntiAlias) { dc.setAntiAlias(true); }
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var hh = horloge.hour.format("%02d");
        var mm = horloge.min.format("%02d");

        if (enVeille && System.getDeviceSettings().requiresBurnInProtection) {
            // Écran toujours allumé : peu de pixels, gris, position qui bouge chaque minute.
            var dx = ((horloge.min % 5) - 2) * 7;
            var dy = (((horloge.min / 5) % 5) - 2) * 7;
            Dessin.texte(dc, cx + dx, cy - h * 6 / 100 + dy, fHeureVeille as Graphics.FontType, hh + ":" + mm, 0x6E6E6E);
            Dessin.texte(dc, cx + dx, cy + h * 14 / 100 + dy, fPetit as Graphics.FontType, (NOMS_MAJ[p[0]] as String) + "  " + hhmm(p[2]), 0x8A6A2A);
            return;
        }

        // Après Isha, la prochaine est Fajr de demain : même place sur l'anneau que celui d'aujourd'hui.
        dessinerAnneau(dc, cx, cy, h, maintenant, p[0]);

        // Date
        var g = Gregorian.info(Time.now(), Time.FORMAT_SHORT);
        var date = (JOURS[(g.day_of_week as Number) - 1] as String) + " " + (g.day as Number).format("%d") + " " + (MOIS[(g.month as Number) - 1] as String);
        Dessin.texte(dc, cx, cy - h * 27 / 100, fDate as Graphics.FontType, date, C_GRIS);

        // Heure : HH (blanc) : (or) MM (blanc)
        var fh = fHeure as Graphics.FontType;
        var wH = dc.getTextWidthInPixels(hh, fh);
        var wP = dc.getTextWidthInPixels(":", fh);
        var wM = dc.getTextWidthInPixels(mm, fh);
        var x0 = cx - (wH + wP + wM) / 2;
        var yH = cy - h * 5 / 100;
        Dessin.texteAligne(dc, x0, yH, fh, hh, Graphics.COLOR_WHITE, false);
        Dessin.texteAligne(dc, x0 + wH, yH, fh, ":", C_OR, false);
        Dessin.texteAligne(dc, x0 + wH + wP, yH, fh, mm, Graphics.COLOR_WHITE, false);

        // Prochaine prière : NOM (or, gras) + heure (blanc), puis le temps restant.
        var nom = NOMS_MAJ[p[0]] as String;
        var heure = "  " + hhmm(p[2]);
        var fp = fPriere as Graphics.FontType;
        var fpf = fPriereFine as Graphics.FontType;
        var wN = dc.getTextWidthInPixels(nom, fp);
        var wT = dc.getTextWidthInPixels(heure, fpf);
        var xp = cx - (wN + wT) / 2;
        var yp = cy + h * 17 / 100;
        Dessin.texteAligne(dc, xp, yp, fp, nom, C_OR, false);
        Dessin.texteAligne(dc, xp + wN, yp, fpf, heure, Graphics.COLOR_WHITE, false);
        Dessin.texte(dc, cx, cy + h * 26 / 100, fPetit as Graphics.FontType, "dans " + duree(reste), reste <= 15 ? C_OR : C_GRIS);

        dessinerBas(dc, cx, cy + h * 35 / 100);
    }

    // Anneau de 24 h : piste sombre, segments nuit / aube / jour / crépuscule, repères des prières, heure actuelle.
    function dessinerAnneau(dc as Graphics.Dc, cx as Number, cy as Number, h as Number, maintenant as Number, suivante as Number) as Void {
        var r = h / 2 - 9;
        var t = aujourdhui;
        dc.setPenWidth(10);
        dc.setColor(0x151515, Graphics.COLOR_TRANSPARENT);
        dc.drawCircle(cx, cy, r);
        Dessin.arc24(dc, cx, cy, r, t[5], t[0], C_NUIT);        // Isha → Fajr
        Dessin.arc24(dc, cx, cy, r, t[0], t[1], C_AUBE);        // Fajr → lever
        Dessin.arc24(dc, cx, cy, r, t[1], t[4], C_JOUR);        // lever → Maghrib
        Dessin.arc24(dc, cx, cy, r, t[4], t[5], C_CREPUSCULE);  // Maghrib → Isha
        dc.setPenWidth(1);

        // Graduations : un point toutes les 3 h, un trait à 0 h, 6 h, 12 h, 18 h.
        for (var k = 0; k < 8; k++) {
            var a = Dessin.angle24(k * 180);
            var rr = (r - 16).toFloat();
            dc.setColor(k % 2 == 0 ? 0x5A5A5A : C_GRIS_FONCE, Graphics.COLOR_TRANSPARENT);
            if (k % 2 == 0) {
                dc.setPenWidth(3);
                dc.drawLine(Dessin.px(cx, rr - 6.0, a), Dessin.py(cy, rr - 6.0, a), Dessin.px(cx, rr + 2.0, a), Dessin.py(cy, rr + 2.0, a));
                dc.setPenWidth(1);
            } else {
                dc.fillCircle(Dessin.px(cx, rr, a), Dessin.py(cy, rr, a), 2);
            }
        }

        // Repères des cinq prières (traits en travers de l'anneau) ; la prochaine en or, plus longue.
        for (var i = 0; i < 6; i++) {
            if (i == 1 || t[i] <= -100000) { continue; }
            var a = Dessin.angle24(t[i]);
            var prochaine = i == suivante;
            var r1 = (r - (prochaine ? 12 : 7)).toFloat();
            var r2 = (r + (prochaine ? 8 : 6)).toFloat();
            dc.setPenWidth(prochaine ? 5 : 3);
            dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_TRANSPARENT);
            dc.drawLine(Dessin.px(cx, r1, a), Dessin.py(cy, r1, a), Dessin.px(cx, r2, a), Dessin.py(cy, r2, a));
            dc.setPenWidth(prochaine ? 3 : 1);
            dc.setColor(prochaine ? C_OR : 0xBDBDBD, Graphics.COLOR_TRANSPARENT);
            dc.drawLine(Dessin.px(cx, r1, a), Dessin.py(cy, r1, a), Dessin.px(cx, r2, a), Dessin.py(cy, r2, a));
        }
        dc.setPenWidth(1);

        // Heure actuelle : point blanc cerclé de noir sur l'anneau.
        var an = Dessin.angle24(maintenant);
        var xn = Dessin.px(cx, r.toFloat(), an);
        var yn = Dessin.py(cy, r.toFloat(), an);
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_TRANSPARENT);
        dc.fillCircle(xn, yn, 10);
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.fillCircle(xn, yn, 7);
    }

    // Pas · cœur · batterie, chaque valeur précédée de son icône, l'ensemble centré.
    function dessinerBas(dc as Graphics.Dc, cx as Number, y as Number) as Void {
        var f = fPetit as Graphics.FontType;
        var am = ActivityMonitor.getInfo();
        var pasTxt = am != null && am.steps != null ? (am.steps as Number).format("%d") : "--";
        var fc = frequenceCardiaque();
        var fcTxt = fc != null ? fc.format("%d") : "--";
        var bat = System.getSystemStats().battery;
        var batTxt = bat.format("%d") + "%";
        var ecart = 18;
        var icone = 24;
        var w1 = dc.getTextWidthInPixels(pasTxt, f);
        var w2 = dc.getTextWidthInPixels(fcTxt, f);
        var w3 = dc.getTextWidthInPixels(batTxt, f);
        var total = 3 * icone + w1 + w2 + w3 + 2 * ecart;
        var x = cx - total / 2;
        Dessin.pas(dc, x + 8, y - 4, C_PAS);
        Dessin.texteAligne(dc, x + icone, y, f, pasTxt, 0xD0D0D0, false);
        x += icone + w1 + ecart;
        Dessin.coeur(dc, x + 9, y - 3, C_COEUR);
        Dessin.texteAligne(dc, x + icone, y, f, fcTxt, 0xD0D0D0, false);
        x += icone + w2 + ecart;
        Dessin.batterie(dc, x + 10, y, bat, bat <= 20.0 ? C_COEUR : 0x7BD88F);
        Dessin.texteAligne(dc, x + icone + 2, y, f, batTxt, 0xD0D0D0, false);
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
