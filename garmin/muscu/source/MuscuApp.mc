// Rayan's Muscu : séance de tractions ou de pompes, répétitions comptées au poignet, repos minuté,
// enregistrée comme activité « Musculation » (une série par circuit, répétitions dans chaque circuit).
import Toybox.Application;
import Toybox.Lang;
import Toybox.WatchUi;

// Exercices : identifiant de réglage, nom affiché, secondes minimum entre deux répétitions.
const EX_TRACTIONS = 0;
const EX_POMPES = 1;
const EX_NOMS = ["Tractions", "Pompes"];
const EX_CLES = ["tractions", "pompes"];
const EX_INTERVALLE = [1.0, 0.6];

class MuscuApp extends Application.AppBase {

    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] {
        var menu = new WatchUi.Menu2({ :title => "Muscu" });
        for (var i = 0; i < EX_NOMS.size(); i++) {
            var cle = EX_CLES[i] as String;
            var sous = reglage(cle + "Series", 4).format("%d") + " × " + reglage(cle + "Reps", 10).format("%d")
                + " · repos " + reglage(cle + "Repos", 90).format("%d") + " s";
            menu.addItem(new WatchUi.MenuItem(EX_NOMS[i] as String, sous, i, {}));
        }
        return [menu, new MenuExercices()];
    }
}

function reglage(cle as String, defaut as Number) as Number {
    var v = Application.Properties.getValue(cle);
    return v instanceof Number ? v : defaut;
}

class MenuExercices extends WatchUi.Menu2InputDelegate {
    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var ex = item.getId() as Number;
        var seance = new Seance(ex);
        var vue = new SeanceVue(seance);
        WatchUi.pushView(vue, new SeanceDelegue(seance, vue), WatchUi.SLIDE_LEFT);
    }
}
