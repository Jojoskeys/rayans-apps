// Envoi au PC : Communications.makeWebRequest passe par Garmin Connect sur l'iPhone (Bluetooth), puis par
// Tailscale jusqu'à Rayan's Télécommande. POST JSON vers <adresse>/api/montre avec le code montre.
// Un seul envoi à la fois. Les saisies envoyées ne sont retirées de la file qu'après une réponse 200.
import Toybox.Communications;
import Toybox.Lang;
import Toybox.System;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.WatchUi;

class Envoyeur {

    var enCours as Boolean = false;
    var test as Boolean = false;
    var envoyes as Array = [];
    var rappel as Method? = null;
    // Résultat du dernier envoi, affiché en bas de l'accueil (« Envoyé 21:04 », ou l'erreur).
    var etat as String = "";

    function initialize() {
    }

    function configure() as Boolean {
        return Config.ADRESSE.length() > 0 && Config.CODE.length() > 0;
    }

    // avecResume : ajoute le résumé du jour (pas, distance, calories, cœur). Sans résumé et file vide : rien à faire.
    function envoyer(avecResume as Boolean) as Void {
        if (enCours) { return; }
        if (!configure()) { etat = "Config absente"; return; }
        var f = Attente.lire();
        if (f.size() == 0 && !avecResume) { return; }
        var corps = { "saisies" => f } as Dictionary;
        if (avecResume) { corps.put("resume", Mesures.resume()); }
        envoyes = Attente.ids(f);
        lancer(corps, false);
    }

    // Test de connexion : envoi vide (rien n'est enregistré sur le PC) ; cb(ok as Boolean, message as String).
    function tester(cb as Method) as Void {
        if (!configure()) { cb.invoke(false, Messages.CONFIG_ABSENTE); return; }
        if (enCours) { cb.invoke(false, "Envoi déjà en cours :\nréessaie dans\nquelques secondes"); return; }
        rappel = cb;
        envoyes = [];
        lancer({ "saisies" => [] } as Dictionary, true);
    }

    function lancer(corps as Dictionary, estTest as Boolean) as Void {
        enCours = true;
        test = estTest;
        try {
            Communications.makeWebRequest(Config.ADRESSE + "/api/montre", corps, {
                :method => Communications.HTTP_REQUEST_METHOD_POST,
                :headers => {
                    "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON,
                    "Authorization" => "Bearer " + Config.CODE
                },
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
            }, method(:reponse));
        } catch (e) {
            reponse(-1, null);
        }
    }

    function reponse(code as Number, data as Dictionary or String or Null) as Void {
        enCours = false;
        if (code == 200 && !test) { Attente.retirer(envoyes); }
        envoyes = [];
        var message = Messages.texte(code, data);
        etat = code == 200 ? (test ? "Connexion OK" : "Envoyé " + heure()) : Messages.court(code);
        if (rappel != null) {
            var cb = rappel as Method;
            rappel = null;
            cb.invoke(code == 200, message);
        }
        test = false;
        WatchUi.requestUpdate();
    }

    function heure() as String {
        var g = Gregorian.info(Time.now(), Time.FORMAT_SHORT);
        return (g.hour as Number).format("%02d") + ":" + (g.min as Number).format("%02d");
    }
}

// Messages simples en français pour les codes de makeWebRequest et du PC.
module Messages {

    const CONFIG_ABSENTE = "Adresse ou code\nabsent : remplir\nconfig.local.json\npuis réinstaller";

    function texte(code as Number, data as Dictionary or String or Null) as String {
        if (code == 200) { return "Connexion OK\nLe PC a répondu"; }
        if (code == 401) { return "Code montre refusé\nRecopie le code\nmontre du PC dans\nconfig.local.json"; }
        if (code == 403) {
            var e = data instanceof Dictionary ? data.get("erreur") : null;
            if (e instanceof String && e.find("Tailscale") != null) { return "Accès refusé :\nTailscale de\nl'iPhone avec ton\ncompte, activé ?"; }
            return "Accès refusé\npar le PC (403)";
        }
        if (code == 404) { return "Télécommande du PC\ntrop ancienne :\nla mettre à jour"; }
        if (code == 429) { return "PC bloqué 15 min\n(trop de mauvais\ncodes)"; }
        if (code == -104) { return "Téléphone absent\nBluetooth et\nGarmin Connect\nouverts sur l'iPhone"; }
        if (code == -101) { return "Trop d'envois\nen attente :\nréessaie"; }
        if (code == -2 || code == -3 || code == -4 || code == -5) { return "Le téléphone\nne répond pas :\nGarmin Connect\nouvert ?"; }
        if (code == -300) { return "PC injoignable\nTailscale activé\nsur l'iPhone ?\nPC allumé ?"; }
        if (code == -400 || code == -1002) { return "Réponse illisible\n(adresse ou\ncertificat ?)"; }
        if (code == -1001) { return "Adresse en\nhttps:// obligatoire"; }
        if (code == -402 || code == -403) { return "Réponse du PC\ntrop grosse"; }
        if (code >= 500) { return "Erreur du PC\n(" + code.format("%d") + ")"; }
        return "Erreur " + code.format("%d") + "\nvoir garmin/README.md";
    }

    // Version d'une ligne pour l'accueil.
    function court(code as Number) as String {
        if (code == -104) { return "Téléphone absent"; }
        if (code == -300) { return "PC injoignable"; }
        if (code == 401) { return "Code refusé"; }
        if (code == 403) { return "Accès refusé"; }
        return "Erreur " + code.format("%d");
    }
}
