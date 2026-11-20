// Mesures du jour lues sur la montre (ActivityMonitor) : rien n'est inventé, une valeur absente reste null.
import Toybox.Activity;
import Toybox.ActivityMonitor;
import Toybox.Lang;
import Toybox.Time;

module Mesures {

    function pas() as Number? {
        var i = ActivityMonitor.getInfo();
        return i != null && i.steps != null ? i.steps as Number : null;
    }

    // ActivityMonitor donne la distance en centimètres : ici en mètres.
    function distance() as Number? {
        var i = ActivityMonitor.getInfo();
        return i != null && i.distance != null ? (i.distance as Number) / 100 : null;
    }

    function calories() as Number? {
        var i = ActivityMonitor.getInfo();
        return i != null && i.calories != null ? i.calories as Number : null;
    }

    // Comme le cadran : mesure en cours, sinon la dernière de l'historique.
    function coeur() as Number? {
        var info = Activity.getActivityInfo();
        if (info != null && info.currentHeartRate != null) { return info.currentHeartRate; }
        if (ActivityMonitor has :getHeartRateHistory) {
            var it = ActivityMonitor.getHeartRateHistory(1, true);
            var e = it.next();
            if (e != null && e.heartRate != null && e.heartRate != ActivityMonitor.INVALID_HR_SAMPLE) { return e.heartRate; }
        }
        return null;
    }

    // Résumé envoyé au PC (secondes depuis 1970, distance en mètres) ; les valeurs inconnues ne sont pas envoyées.
    function resume() as Dictionary {
        var r = { "at" => Time.now().value() } as Dictionary;
        var v = pas();
        if (v != null) { r.put("pas", v); }
        v = distance();
        if (v != null) { r.put("distance", v); }
        v = calories();
        if (v != null) { r.put("calories", v); }
        v = coeur();
        if (v != null) { r.put("coeur", v); }
        return r;
    }

    // « 6,15 km » ou « 850 m ».
    function texteDistance(m as Number?) as String {
        if (m == null) { return "--"; }
        if (m < 1000) { return m.format("%d") + " m"; }
        return (m / 1000).format("%d") + "," + ((m % 1000) / 10).format("%02d") + " km";
    }

    function texte(v as Number?) as String {
        return v == null ? "--" : v.format("%d");
    }
}
