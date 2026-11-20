// Rayan's Montre : pas, cœur, distance et calories du jour à l'écran ; saisies rapides (verre d'eau, séance faite,
// humeur 1 à 5) envoyées au PC à travers Garmin Connect sur l'iPhone, puis Rayan's Télécommande (POST /api/montre).
// Les saisies attendent dans une file sur la montre (50 au plus) tant que le PC n'a pas répondu « 200 ».
import Toybox.Application;
import Toybox.Lang;
import Toybox.WatchUi;

class MontreApp extends Application.AppBase {

    var envoyeur as Envoyeur;

    function initialize() {
        AppBase.initialize();
        envoyeur = new Envoyeur();
    }

    function getInitialView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] {
        envoyeur.envoyer(true);   // à l'ouverture : la file en attente et le résumé du jour
        var vue = new AccueilVue();
        return [vue, new AccueilDelegue()];
    }
}

function envoyeur() as Envoyeur {
    return (Application.getApp() as MontreApp).envoyeur;
}
