// Rayan's Muscu : séance de tractions ou de pompes, répétitions comptées au poignet, repos minuté,
// enregistrée comme activité « Musculation » (une série et son repos par circuit, répétitions dans chaque circuit).
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
        var vue = new AccueilVue();
        return [vue, new AccueilDelegue(vue)];
    }
}

function reglage(cle as String, defaut as Number) as Number {
    var v = Application.Properties.getValue(cle);
    return v instanceof Number ? v : defaut;
}
