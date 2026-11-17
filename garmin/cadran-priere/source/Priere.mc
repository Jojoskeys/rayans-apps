// Horaires de prière calculés sur la montre, sans téléphone : même calcul que Rayan's Prière
// (priere/src/core/praytimes.ts, méthode PrayTimes.org), règle des hautes latitudes « angle ».
// Tout est en Double : en Float (24 bits) l'erreur atteindrait plusieurs minutes.
import Toybox.Lang;
import Toybox.Math;

(:background)
module Priere {

    // Méthodes, dans l'ordre du réglage « methode » :
    // 0 UOIF 12°/12°, 1 France 15°, 2 Ligue islamique mondiale 18°/17°, 3 ISNA 15°/15°,
    // 4 Égypte 19,5°/17,5°, 5 Umm al-Qura 18,5° et Isha 90 min après Maghrib, 6 Karachi 18°/18°.
    const FAJR = [12.0d, 15.0d, 18.0d, 15.0d, 19.5d, 18.5d, 18.0d];
    // Valeur négative : minutes après Maghrib (Umm al-Qura).
    const ISHA = [12.0d, 15.0d, 17.0d, 15.0d, 17.5d, -90.0d, 18.0d];

    const NOMS = ["Fajr", "Chourouq", "Dhuhr", "Asr", "Maghrib", "Isha"];
    const INVALIDE = -1000.0d;

    const PI_D = 3.141592653589793d;

    function rad(d as Double) as Double { return d * PI_D / 180.0d; }
    function deg(r as Double) as Double { return r * 180.0d / PI_D; }
    function dsin(d as Double) as Double { return Math.sin(rad(d)).toDouble(); }
    function dcos(d as Double) as Double { return Math.cos(rad(d)).toDouble(); }
    function dtan(d as Double) as Double { return Math.tan(rad(d)).toDouble(); }

    function fix(a as Double, b as Double) as Double {
        var q = a / b;
        var f = q.toLong().toDouble();
        if (f > q) { f -= 1.0d; }
        var r = a - b * f;
        return r < 0.0d ? r + b : r;
    }

    function fixHour(h as Double) as Double { return fix(h, 24.0d); }

    // [déclinaison, équation du temps] pour D jours depuis J2000.
    function soleil(D as Double) as Array<Double> {
        var g = fix(357.529d + 0.98560028d * D, 360.0d);
        var q = fix(280.459d + 0.98564736d * D, 360.0d);
        var L = fix(q + 1.915d * dsin(g) + 0.02d * dsin(2.0d * g), 360.0d);
        var e = 23.439d - 0.00000036d * D;
        var RA = deg(Math.atan2(dcos(e) * dsin(L), dcos(L)).toDouble()) / 15.0d;
        var decl = deg(Math.asin(dsin(e) * dsin(L)).toDouble());
        return [decl, q / 15.0d - fixHour(RA)];
    }

    function midi(D0 as Double, t as Double) as Double {
        return fixHour(12.0d - soleil(D0 + t)[1]);
    }

    // Heure (UT décalée de la longitude) où le soleil est à « angle » sous l'horizon.
    function heureAngle(D0 as Double, lat as Double, angle as Double, t as Double, avantMidi as Boolean) as Double {
        var decl = soleil(D0 + t)[0];
        var noon = midi(D0, t);
        var v = (-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat));
        if (v < -1.0d || v > 1.0d) { return INVALIDE; }
        var h = deg(Math.acos(v).toDouble()) / 15.0d;
        return avantMidi ? noon - h : noon + h;
    }

    function heureAsr(D0 as Double, lat as Double, facteur as Double, t as Double) as Double {
        var decl = soleil(D0 + t)[0];
        var x = facteur + dtan((lat - decl).abs());
        var angle = -deg(Math.atan(1.0d / x).toDouble());
        return heureAngle(D0, lat, angle, t, false);
    }

    // Horaires d'un jour en minutes depuis minuit local : [Fajr, Chourouq, Dhuhr, Asr, Maghrib, Isha].
    // jourUnix : nombre de jours depuis le 1er janvier 1970 de la date civile ; tzHeures : décalage du fuseau.
    // Une valeur négative très grande (INVALIDE) signifie « n'existe pas ce jour-là ».
    function jour(lat as Double, lng as Double, tzHeures as Double, jourUnix as Number,
                  methode as Number, hanafi as Boolean) as Array<Number> {
        if (methode < 0 || methode >= FAJR.size()) { methode = 0; }
        var angleFajr = FAJR[methode] as Double;
        var isha = ISHA[methode] as Double;
        var D0 = jourUnix.toDouble() - 10957.5d - lng / 360.0d;
        var riseSet = 0.833d;

        var tf = heureAngle(D0, lat, angleFajr, 5.0d / 24.0d, true);
        var tl = heureAngle(D0, lat, riseSet, 6.0d / 24.0d, true);
        var td = midi(D0, 12.0d / 24.0d);
        var ta = heureAsr(D0, lat, hanafi ? 2.0d : 1.0d, 13.0d / 24.0d);
        var tm = heureAngle(D0, lat, riseSet, 18.0d / 24.0d, false);
        var ti = isha > 0.0d ? heureAngle(D0, lat, isha, 18.0d / 24.0d, false) : INVALIDE;

        var t = [tf, tl, td, ta, tm, ti];
        var shift = tzHeures - lng / 15.0d;
        for (var i = 0; i < t.size(); i++) {
            if (t[i] != INVALIDE) { t[i] = (t[i] as Double) + shift; }
        }
        tf = t[0] as Double; tl = t[1] as Double; tm = t[4] as Double; ti = t[5] as Double;

        // Hautes latitudes, règle « angle » : au plus angle/60 de la nuit avant le lever / après le coucher.
        if (tl != INVALIDE && tm != INVALIDE) {
            var nuit = fixHour(tl - tm);
            var fp = angleFajr / 60.0d * nuit;
            if (tf == INVALIDE || fixHour(tl - tf) > fp) { t[0] = tl - fp; }
            if (isha > 0.0d) {
                var ip = isha / 60.0d * nuit;
                if (ti == INVALIDE || fixHour(ti - tm) > ip) { t[5] = tm + ip; }
            }
        }
        if (isha < 0.0d && tm != INVALIDE) { t[5] = tm - isha / 60.0d; }

        var out = new Array<Number>[6];
        for (var i = 0; i < 6; i++) {
            var h = t[i] as Double;
            out[i] = h == INVALIDE ? -100000 : Math.round(h * 60.0d).toNumber();
        }
        return out;
    }
}
