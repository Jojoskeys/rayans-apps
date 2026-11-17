// Réglages sur la montre (une app copiée par câble ne peut pas être réglée depuis Garmin Connect) :
// objectif par série et rappel de pause de chaque exercice, sensibilité du comptage.
import Toybox.Application;
import Toybox.Lang;
import Toybox.WatchUi;

module Reglages {

    const OBJECTIFS = [0, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 20, 25, 30, 35, 40, 50];
    const RAPPELS = [0, 45, 60, 75, 90, 120, 150, 180, 240, 300];
    const SENSIBILITES = ["Basse (moins de faux comptes)", "Normale", "Haute (petits mouvements)"];

    function texteObjectif(v as Number) as String { return v == 0 ? "libre" : v.format("%d") + " répétitions"; }
    function texteRappel(v as Number) as String { return v == 0 ? "aucun" : Dessin.mmss(v); }

    // [clé, titre, liste de valeurs (null : sensibilité), défaut]
    function entrees() as Array<Array> {
        return [
            ["tractionsObjectif", "Tractions : objectif", OBJECTIFS, 7],
            ["tractionsRappel", "Tractions : rappel de pause", RAPPELS, 0],
            ["pompesObjectif", "Pompes : objectif", OBJECTIFS, 15],
            ["pompesRappel", "Pompes : rappel de pause", RAPPELS, 0],
            ["sensibilite", "Sensibilité du comptage", null, 1]
        ] as Array<Array>;
    }

    function texte(e as Array, v as Number) as String {
        var cle = e[0] as String;
        if (e[2] == null) { return SENSIBILITES[v < 0 || v > 2 ? 1 : v] as String; }
        return cle.find("Rappel") != null ? texteRappel(v) : texteObjectif(v);
    }

    function ouvrir() as Void {
        var menu = new WatchUi.Menu2({ :title => "Réglages" });
        var es = entrees();
        for (var i = 0; i < es.size(); i++) {
            var e = es[i];
            menu.addItem(new WatchUi.MenuItem(e[1] as String, texte(e, reglage(e[0] as String, e[3] as Number)), i, {}));
        }
        WatchUi.pushView(menu, new MenuReglages(menu), WatchUi.SLIDE_LEFT);
    }
}

class MenuReglages extends WatchUi.Menu2InputDelegate {
    var menu as WatchUi.Menu2;

    function initialize(m as WatchUi.Menu2) {
        Menu2InputDelegate.initialize();
        menu = m;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var e = Reglages.entrees()[item.getId() as Number];
        var actuel = reglage(e[0] as String, e[3] as Number);
        var choix = new WatchUi.Menu2({ :title => e[1] as String });
        var valeurs = e[2] == null ? [0, 1, 2] : e[2] as Array<Number>;
        var focus = 0;
        for (var i = 0; i < valeurs.size(); i++) {
            var v = valeurs[i] as Number;
            choix.addItem(new WatchUi.MenuItem(Reglages.texte(e, v), v == actuel ? "actuel" : null, v, {}));
            if (v == actuel) { focus = i; }
        }
        choix.setFocus(focus);
        WatchUi.pushView(choix, new MenuValeur(e, item), WatchUi.SLIDE_LEFT);
    }
}

class MenuValeur extends WatchUi.Menu2InputDelegate {
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
        parent.setSubLabel(Reglages.texte(entree, v));
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
    }
}
