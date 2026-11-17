import Toybox.Application;
import Toybox.Lang;
import Toybox.WatchUi;

class Champ5kmApp extends Application.AppBase {

    var vue as Champ5kmVue?;

    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] {
        vue = new Champ5kmVue();
        return [vue];
    }

    function onSettingsChanged() as Void {
        if (vue != null) { vue.lireReglages(); }
        WatchUi.requestUpdate();
    }
}
