// Réglages du cadran sur la montre : alerte de prière (oui/non, avance), méthode de calcul, Asr, décalage.
import Toybox.Application;
import Toybox.Lang;
import Toybox.WatchUi;

module ReglagesCadran {

    const METHODES = ["UOIF (France, 12°)", "France 15°", "Ligue islamique mondiale", "ISNA", "Autorité égyptienne", "Umm al-Qura", "Karachi"];
    const ASR = ["Standard (ombre × 1)", "Hanafite (ombre × 2)"];
    const AVANCES = [0, 5, 10, 15, 20, 30];
    const DECALAGES = [-10, -5, -3, -2, -1, 0, 1, 2, 3, 5, 10];

    function avance(v as Number) as String { return v == 0 ? "à l'heure" : v.format("%d") + " min avant"; }
    function decalage(v as Number) as String { return v == 0 ? "aucun" : (v > 0 ? "+" : "") + v.format("%d") + " min"; }

    // [clé, titre, valeurs, textes (null : calculés), défaut]
    function entrees() as Array<Array> {
        return [
            ["alerteAvance", "Moment de l'alerte", AVANCES, null, 0],
            ["methode", "Méthode de calcul", [0, 1, 2, 3, 4, 5, 6], METHODES, 0],
            ["ecoleAsr", "Asr", [0, 1], ASR, 0],
            ["decalage", "Décalage des horaires", DECALAGES, null, 0]
        ] as Array<Array>;
    }

    function texte(e as Array, v as Number) as String {
        var textes = e[3];
        if (textes != null) {
            var t = textes as Array<String>;
            return v >= 0 && v < t.size() ? t[v] : t[0];
        }
        return (e[0] as String).equals("alerteAvance") ? avance(v) : decalage(v);
    }

    function nombre(cle as String, defaut as Number) as Number {
        var v = Application.Properties.getValue(cle);
        return v instanceof Number ? v : defaut;
    }

    function vue() as [WatchUi.Views, WatchUi.InputDelegates] {
        var menu = new WatchUi.Menu2({ :title => "Rayan’s Prière" });
        var on = Application.Properties.getValue("alertes");
        menu.addItem(new WatchUi.ToggleMenuItem("Alerte à chaque prière", "vibration + notification", :alertes, on instanceof Boolean ? on : true, {}));
        var es = entrees();
        for (var i = 0; i < es.size(); i++) {
            var e = es[i];
            menu.addItem(new WatchUi.MenuItem(e[1] as String, texte(e, nombre(e[0] as String, e[4] as Number)), i, {}));
        }
        return [menu, new MenuReglagesCadran()];
    }
}

class MenuReglagesCadran extends WatchUi.Menu2InputDelegate {

    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        if (item.getId() == :alertes) {
            Application.Properties.setValue("alertes", (item as WatchUi.ToggleMenuItem).isEnabled());
            Planif.programmer();
            return;
        }
        var e = ReglagesCadran.entrees()[item.getId() as Number];
        var actuel = ReglagesCadran.nombre(e[0] as String, e[4] as Number);
        var choix = new WatchUi.Menu2({ :title => e[1] as String });
        var valeurs = e[2] as Array<Number>;
        var focus = 0;
        for (var i = 0; i < valeurs.size(); i++) {
            var v = valeurs[i];
            choix.addItem(new WatchUi.MenuItem(ReglagesCadran.texte(e, v), v == actuel ? "actuel" : null, v, {}));
            if (v == actuel) { focus = i; }
        }
        choix.setFocus(focus);
        WatchUi.pushView(choix, new MenuValeurCadran(e, item), WatchUi.SLIDE_LEFT);
    }
}

class MenuValeurCadran extends WatchUi.Menu2InputDelegate {
    var entree as Array;
    var parent as WatchUi.MenuItem;

    function initialize(e as Array, p as WatchUi.MenuItem) {
        Menu2InputDelegate.initialize();
        entree = e;
        parent = p;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var v = item.getId() as Number;
        Application.Properties.setValue(entree[0] as String, v);
        parent.setSubLabel(ReglagesCadran.texte(entree, v));
        Planif.programmer();
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
    }
}
