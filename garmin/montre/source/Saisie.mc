// Menu de saisie : verre d'eau +1, séance faite, humeur 1 à 5, envoyer maintenant, tester la connexion.
// Chaque saisie est mise en file (horodatée) puis envoyée tout de suite ; si le PC ne répond pas, elle attend.
import Toybox.Attention;
import Toybox.Lang;
import Toybox.WatchUi;

module Saisie {

    const HUMEURS = ["Très mal", "Pas bien", "Moyen", "Bien", "Très bien"];

    function ouvrir() as Void {
        var menu = new WatchUi.Menu2({ :title => "Noter" });
        menu.addItem(new WatchUi.MenuItem("Verre d'eau +1", "aujourd'hui : " + Jour.eau().format("%d"), :eau, {}));
        menu.addItem(new WatchUi.MenuItem("Séance faite", Jour.seances() > 0 ? "déjà notée aujourd'hui" : null, :seance, {}));
        menu.addItem(new WatchUi.MenuItem("Humeur", Jour.humeur() > 0 ? "notée : " + Jour.humeur().format("%d") + "/5" : "1 à 5", :humeur, {}));
        var n = Attente.lire().size();
        menu.addItem(new WatchUi.MenuItem("Envoyer maintenant", n > 0 ? n.format("%d") + " en attente" : "rien en attente", :envoyer, {}));
        menu.addItem(new WatchUi.MenuItem("Tester la connexion", "montre > iPhone > PC", :tester, {}));
        WatchUi.pushView(menu, new MenuSaisie(), WatchUi.SLIDE_LEFT);
    }

    function noter(type as String, valeur as Number?) as Void {
        Attente.ajouter(type, valeur);
        if (Attention has :vibrate) {
            Attention.vibrate([new Attention.VibeProfile(60, 120)] as Array<Attention.VibeProfile>);
        }
        envoyeur().envoyer(false);
    }
}

class MenuSaisie extends WatchUi.Menu2InputDelegate {

    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var id = item.getId();
        if (id == :eau) {
            Saisie.noter("eau", null);
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
        } else if (id == :seance) {
            Saisie.noter("seance", null);
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
        } else if (id == :humeur) {
            var m = new WatchUi.Menu2({ :title => "Humeur" });
            for (var i = 5; i >= 1; i--) {
                m.addItem(new WatchUi.MenuItem(i.format("%d") + " - " + Saisie.HUMEURS[i - 1], null, i, {}));
            }
            WatchUi.pushView(m, new MenuHumeur(), WatchUi.SLIDE_LEFT);
        } else if (id == :envoyer) {
            envoyeur().envoyer(true);
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
        } else if (id == :tester) {
            var v = new TestVue();
            WatchUi.pushView(v, new TestDelegue(), WatchUi.SLIDE_LEFT);
            envoyeur().tester(v.method(:resultat));
        }
    }
}

class MenuHumeur extends WatchUi.Menu2InputDelegate {

    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        Saisie.noter("humeur", item.getId() as Number);
        WatchUi.popView(WatchUi.SLIDE_RIGHT);   // menu Humeur
        WatchUi.popView(WatchUi.SLIDE_RIGHT);   // menu Noter : retour à l'accueil
    }
}
