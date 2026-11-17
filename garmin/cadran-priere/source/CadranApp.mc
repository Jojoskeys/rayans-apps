import Toybox.Application;
import Toybox.Lang;
import Toybox.System;
import Toybox.WatchUi;

// (:background) : l'app est aussi chargée par le service qui affiche l'alerte de prière.
(:background)
class CadranApp extends Application.AppBase {

    var vue = null;

    function initialize() {
        AppBase.initialize();
    }

    (:typecheck(disableBackgroundCheck))
    function getInitialView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] {
        vue = new CadranVue();
        return [vue as CadranVue];
    }

    function getServiceDelegate() as [System.ServiceDelegate] {
        return [new AlertePriere()];
    }

    // Réglages du cadran sur la montre (appui long sur le cadran → Personnaliser / Réglages).
    (:typecheck(disableBackgroundCheck))
    function getSettingsView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] or Null {
        return ReglagesCadran.vue();
    }

    // Réglages changés : horaires et alerte recalculés.
    (:typecheck(disableBackgroundCheck))
    function onSettingsChanged() as Void {
        if (vue != null) { (vue as CadranVue).reinitialiser(); }
        Planif.programmer();
        WatchUi.requestUpdate();
    }
}
