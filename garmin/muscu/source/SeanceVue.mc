import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

const C_VERT = 0x00C853;
const C_AMBRE = 0xFFB300;
const C_GRIS_M = 0xAAAAAA;

class SeanceVue extends WatchUi.View {

    var seance as Seance;

    function initialize(s as Seance) {
        View.initialize();
        seance = s;
    }

    function texteSeries() as String {
        var s = "";
        for (var i = 0; i < seance.series.size(); i++) {
            s += (i > 0 ? " · " : "") + seance.series[i].format("%d");
        }
        return s;
    }

    function mmss(s as Number) as String {
        var a = s < 0 ? -s : s;
        return (s < 0 ? "+" : "") + (a / 60).format("%d") + ":" + (a % 60).format("%02d");
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        var cy = h / 2;
        var c = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        if (dc has :setAntiAlias) { dc.setAntiAlias(true); }
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();

        var numero = seance.series.size() + (seance.etat == ETAT_SERIE ? 1 : 0);
        var restantes = seance.seriesVisees - seance.series.size();
        if (restantes < 0) { restantes = 0; }

        dc.setColor(C_GRIS_M, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - h * 36 / 100, Graphics.FONT_SMALL, seance.nom, c);

        if (seance.etat == ETAT_PRET) {
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, cy - h * 12 / 100, Graphics.FONT_MEDIUM,
                seance.seriesVisees.format("%d") + " × " + seance.repsVisees.format("%d"), c);
            dc.drawText(cx, cy + h * 2 / 100, Graphics.FONT_SMALL, "repos " + seance.repos.format("%d") + " s", c);
            var d = seance.derniere();
            if (d != null && d.size() > 0) {
                var t = "";
                for (var i = 0; i < d.size(); i++) { t += (i > 0 ? " · " : "") + d[i].format("%d"); }
                dc.setColor(C_GRIS_M, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, cy + h * 16 / 100, Graphics.FONT_XTINY, "Dernière fois : " + t, c);
            }
            dc.setColor(C_VERT, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, cy + h * 30 / 100, Graphics.FONT_SMALL, "START : série 1", c);
            return;
        }

        if (seance.etat == ETAT_SERIE) {
            var reps = seance.compteur.reps;
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, cy - h * 24 / 100, Graphics.FONT_SMALL,
                "Série " + numero.format("%d") + " / " + seance.seriesVisees.format("%d"), c);
            dc.setColor(reps >= seance.repsVisees ? C_VERT : Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, cy + h * 1 / 100, Graphics.FONT_NUMBER_THAI_HOT, reps.format("%d"), c);
            dc.setColor(C_GRIS_M, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, cy + h * 22 / 100, Graphics.FONT_SMALL,
                "objectif " + seance.repsVisees.format("%d") + "  ·  " + mmss(seance.secondesEcoulees()), c);
            dc.drawText(cx, cy + h * 32 / 100, Graphics.FONT_XTINY, "HAUT/BAS : ±1", c);
            return;
        }

        if (seance.etat == ETAT_REPOS) {
            var r = seance.reposRestant();
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, cy - h * 24 / 100, Graphics.FONT_SMALL,
                restantes == 0 ? "Séries faites" : ("Encore " + restantes.format("%d") + " série" + (restantes > 1 ? "s" : "")), c);
            dc.setColor(r <= 0 ? C_AMBRE : Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, cy, Graphics.FONT_NUMBER_HOT, mmss(r), c);
            dc.setColor(C_GRIS_M, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, cy + h * 21 / 100, Graphics.FONT_SMALL, texteSeries(), c);
            dc.setColor(C_VERT, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, cy + h * 32 / 100, Graphics.FONT_XTINY,
                restantes == 0 ? "RETOUR : fin" : "START : série " + (numero + 1).format("%d"), c);
            return;
        }

        // Fin
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - h * 20 / 100, Graphics.FONT_MEDIUM, seance.enregistree ? "Enregistrée" : "Non enregistrée", c);
        dc.drawText(cx, cy, Graphics.FONT_NUMBER_MEDIUM, seance.total().format("%d"), c);
        dc.setColor(C_GRIS_M, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy + h * 15 / 100, Graphics.FONT_SMALL,
            seance.series.size().format("%d") + (seance.series.size() > 1 ? " séries" : " série") + " · meilleure " + seance.meilleure().format("%d"), c);
        dc.drawText(cx, cy + h * 26 / 100, Graphics.FONT_XTINY, texteSeries(), c);
    }
}

class SeanceDelegue extends WatchUi.BehaviorDelegate {

    var seance as Seance;
    var vue as SeanceVue;

    function initialize(s as Seance, v as SeanceVue) {
        BehaviorDelegate.initialize();
        seance = s;
        vue = v;
    }

    function onSelect() as Boolean {
        var e = seance.etat;
        if (e == ETAT_PRET || e == ETAT_REPOS) { seance.commencerSerie(); }
        else if (e == ETAT_SERIE) { seance.finirSerie(); }
        else { WatchUi.popView(WatchUi.SLIDE_RIGHT); }
        return true;
    }

    function onPreviousPage() as Boolean { seance.corriger(1); return true; }
    function onNextPage() as Boolean { seance.corriger(-1); return true; }

    function onBack() as Boolean {
        if (seance.etat == ETAT_FIN) { WatchUi.popView(WatchUi.SLIDE_RIGHT); return true; }
        if (seance.etat == ETAT_PRET && seance.series.size() == 0) {
            seance.terminer(false);
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
            return true;
        }
        var menu = new WatchUi.Menu2({ :title => "Fin de séance ?" });
        menu.addItem(new WatchUi.MenuItem("Enregistrer", null, :garder, {}));
        menu.addItem(new WatchUi.MenuItem("Reprendre", null, :reprendre, {}));
        menu.addItem(new WatchUi.MenuItem("Supprimer", null, :supprimer, {}));
        WatchUi.pushView(menu, new MenuFin(seance), WatchUi.SLIDE_UP);
        return true;
    }
}

class MenuFin extends WatchUi.Menu2InputDelegate {
    var seance as Seance;

    function initialize(s as Seance) {
        Menu2InputDelegate.initialize();
        seance = s;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var id = item.getId();
        WatchUi.popView(WatchUi.SLIDE_DOWN);
        if (id == :garder) { seance.terminer(true); }
        else if (id == :supprimer) { seance.terminer(false); }
    }
}
