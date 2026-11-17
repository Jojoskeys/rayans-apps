import Toybox.Application;
import Toybox.Lang;
import Toybox.WatchUi;

class CadranApp extends Application.AppBase {

    var vue as CadranVue?;

    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] {
        vue = new CadranVue();
        return [vue];
    }

    // Réglages changés dans l'app Garmin Connect du téléphone : on recalcule les horaires.
    function onSettingsChanged() as Void {
        if (vue != null) { vue.reinitialiser(); }
        WatchUi.requestUpdate();
    }
}
