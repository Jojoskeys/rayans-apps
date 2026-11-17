// Alerte à l'heure de chaque prière : le cadran programme un réveil (événement temporel) à l'heure de la
// prochaine prière ; le service en arrière-plan affiche alors une notification de la montre (avec la vibration
// des notifications) « C'est l'heure de Asr — 15:20 », puis programme la suivante. Réglages : alerte oui/non,
// minutes d'avance. Chourouq (lever du soleil) n'est pas une prière : pas d'alerte.
import Toybox.Application;
import Toybox.Background;
import Toybox.Lang;
import Toybox.Notifications;
import Toybox.System;
import Toybox.Time;
import Toybox.Time.Gregorian;

const PRIERES_ALERTE = [0, 2, 3, 4, 5];

(:background)
module Planif {

    function nombre(cle as String, defaut as Number) as Number {
        var v = Application.Properties.getValue(cle);
        return v instanceof Number ? v : defaut;
    }

    function decimal(cle as String, defaut as Double) as Double {
        var v = Application.Properties.getValue(cle);
        return (v instanceof Float || v instanceof Double || v instanceof Number) ? (v as Numeric).toDouble() : defaut;
    }

    function actives() as Boolean {
        var v = Application.Properties.getValue("alertes");
        return v instanceof Boolean ? v : true;
    }

    // Position : réglage manuel, sinon la dernière gardée par le cadran, sinon Rennes.
    function position() as Array<Double> {
        var m = Application.Properties.getValue("positionManuelle");
        if (m instanceof Boolean && m) { return [decimal("latitude", 48.1173d), decimal("longitude", -1.6778d)]; }
        var g = Application.Storage.getValue("position");
        if (g instanceof Array && g.size() == 2) { return [(g[0] as Numeric).toDouble(), (g[1] as Numeric).toDouble()]; }
        return [48.1173d, -1.6778d];
    }

    function jourUnix(t as Time.Moment) as Number {
        var g = Gregorian.info(t, Time.FORMAT_SHORT);
        var m = Gregorian.moment({ :year => g.year, :month => g.month, :day => g.day, :hour => 0, :minute => 0, :second => 0 });
        return (m.value() / 86400).toNumber();
    }

    // Horaires du jour n (minutes depuis minuit local), décalage des réglages compris (sauf Chourouq).
    function horaires(n as Number) as Array<Number> {
        var pos = position();
        var tz = System.getClockTime().timeZoneOffset.toDouble() / 3600.0d;
        var h = Priere.jour(pos[0], pos[1], tz, n, nombre("methode", 0), nombre("ecoleAsr", 0) == 1);
        var d = nombre("decalage", 0);
        for (var i = 0; i < h.size(); i++) { if (i != 1 && h[i] > -100000) { h[i] = h[i] + d; } }
        return h;
    }

    // Alertes d'aujourd'hui et de demain : [[instant unix de l'alerte, prière, minute locale de la prière], …].
    function alertes() as Array<Array<Number>> {
        var out = [] as Array<Array<Number>>;
        var maintenant = Time.now();
        var n = jourUnix(maintenant);
        var tz = System.getClockTime().timeZoneOffset;
        var avance = nombre("alerteAvance", 0);
        for (var d = 0; d < 2; d++) {
            var h = horaires(n + d);
            var minuit = (n + d) * 86400 - tz;
            for (var k = 0; k < PRIERES_ALERTE.size(); k++) {
                var i = PRIERES_ALERTE[k] as Number;
                if (h[i] <= -100000) { continue; }
                out.add([minuit + h[i] * 60 - avance * 60, i, h[i]] as Array<Number>);
            }
        }
        return out;
    }

    // Prochaine alerte (au moins 30 s dans le futur), ou null si les alertes sont coupées.
    function prochaine() as Array<Number>? {
        if (!actives()) { return null; }
        var t = Time.now().value() + 30;
        var a = alertes();
        for (var i = 0; i < a.size(); i++) { if (a[i][0] > t) { return a[i]; } }
        return null;
    }

    // Alerte dont l'heure est à moins de 5 minutes de maintenant (réveil un peu en avance ou en retard).
    function maintenant() as Array<Number>? {
        var t = Time.now().value();
        var a = alertes();
        for (var i = 0; i < a.size(); i++) { if ((a[i][0] - t).abs() <= 300) { return a[i]; } }
        return null;
    }

    // Programme le réveil de la prochaine alerte (sans rien changer s'il est déjà bon).
    function programmer() as Void {
        if (!(Toybox has :Background)) { return; }
        var p = prochaine();
        if (p == null) { Background.deleteTemporalEvent(); return; }
        // La montre refuse un réveil à moins de 5 minutes du précédent : on le décale juste après.
        var quand = p[0];
        var dernier = Background.getLastTemporalEventTime();
        if (dernier != null && quand < dernier.value() + 300) { quand = dernier.value() + 301; }
        var deja = Background.getTemporalEventRegisteredTime();
        if (deja instanceof Time.Moment && deja.value() == quand) { return; }
        try {
            Background.registerForTemporalEvent(new Time.Moment(quand));
        } catch (e) {
            System.println("alerte non programmée : " + e.getErrorMessage());
        }
    }

    function hhmm(minutes as Number) as String {
        var m = ((minutes % 1440) + 1440) % 1440;
        return (m / 60).format("%d") + ":" + (m % 60).format("%02d");
    }
}

(:background)
class AlertePriere extends System.ServiceDelegate {

    function initialize() {
        ServiceDelegate.initialize();
    }

    function onTemporalEvent() as Void {
        var a = Planif.maintenant();
        if (a != null && (Toybox has :Notifications)) {
            var nom = Priere.NOMS[a[1]] as String;
            var avance = Planif.nombre("alerteAvance", 0);
            var titre = avance > 0 ? nom + " dans " + avance.format("%d") + " min" : "C'est l'heure de " + nom;
            Notifications.showNotification(titre, Planif.hhmm(a[2]), { :body => "Rayan’s Prière", :dismissPrevious => true });
        }
        Planif.programmer();
        Background.exit(null);
    }
}
