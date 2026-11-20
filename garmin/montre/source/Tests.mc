// Tests de la file d'attente et des messages (sans réseau). Seulement dans la version de test.
import Toybox.Lang;
import Toybox.Test;

(:test)
function filePlafonnee(logger as Test.Logger) as Boolean {
    var f = [] as Array;
    for (var i = 0; i < FILE_MAX + 5; i++) {
        f = Attente.avecSaisie(f, { "id" => "s" + i.format("%d"), "type" => "eau", "at" => 1800000000 + i } as Dictionary);
    }
    Test.assertEqual(f.size(), FILE_MAX);
    Test.assertEqual((f[0] as Dictionary).get("id"), "s5");   // les plus anciennes sont parties
    return true;
}

(:test)
function retraitApres200(logger as Test.Logger) as Boolean {
    var f = [
        { "id" => "a", "type" => "eau", "at" => 1 },
        { "id" => "b", "type" => "seance", "at" => 2 },
        { "id" => "c", "type" => "humeur", "at" => 3, "valeur" => 4 }
    ];
    var envoyes = Attente.ids(f);
    Test.assertEqual(envoyes.size(), 3);
    // Une saisie notée pendant l'envoi reste dans la file.
    f.add({ "id" => "d", "type" => "eau", "at" => 4 });
    var reste = Attente.sans(f, envoyes);
    Test.assertEqual(reste.size(), 1);
    Test.assertEqual((reste[0] as Dictionary).get("id"), "d");
    return true;
}

(:test)
function messagesEnFrancais(logger as Test.Logger) as Boolean {
    Test.assert(Messages.texte(-104, null).find("Garmin Connect") != null);
    Test.assert(Messages.texte(401, null).find("Code montre") != null);
    Test.assert(Messages.texte(200, null).find("OK") != null);
    Test.assertEqual(Messages.court(-300), "PC injoignable");
    return true;
}
