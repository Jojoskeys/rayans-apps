// File d'attente des saisies (Application.Storage, clé « file ») : chaque saisie est horodatée et garde un
// identifiant unique, pour que le PC ne la compte pas deux fois si la réponse se perd. 50 au plus : au-delà, la
// plus ancienne est retirée. Une saisie ne quitte la file qu'après une réponse 200 du PC.
// Compteurs du jour (clé « jour ») : affichés sur la montre, même sans connexion.
import Toybox.Application;
import Toybox.Lang;
import Toybox.Time;
import Toybox.Time.Gregorian;

const FILE_MAX = 50;

module Attente {

    function lire() as Array {
        var v = Application.Storage.getValue("file");
        return v instanceof Array ? v : [];
    }

    // Ajoute une saisie à une file et garde les FILE_MAX plus récentes (sans toucher au stockage : testable).
    function avecSaisie(f as Array, s as Dictionary) as Array {
        f.add(s);
        if (f.size() > FILE_MAX) { f = f.slice(f.size() - FILE_MAX, null); }
        return f;
    }

    // Retire d'une file les saisies dont l'identifiant est dans ids.
    function sans(f as Array, ids as Array) as Array {
        var reste = [];
        for (var i = 0; i < f.size(); i++) {
            var s = f[i];
            var garder = true;
            if (s instanceof Dictionary) {
                var id = s.get("id");
                for (var k = 0; k < ids.size(); k++) {
                    if (id != null && id.equals(ids[k])) { garder = false; break; }
                }
            }
            if (garder) { reste.add(s); }
        }
        return reste;
    }

    function ids(f as Array) as Array {
        var r = [];
        for (var i = 0; i < f.size(); i++) {
            var s = f[i];
            if (s instanceof Dictionary && s.get("id") != null) { r.add(s.get("id")); }
        }
        return r;
    }

    // type : "eau", "seance" ou "humeur" (valeur 1 à 5).
    function ajouter(type as String, valeur as Number?) as Void {
        var n = Application.Storage.getValue("n");
        n = n instanceof Number ? n + 1 : 1;
        Application.Storage.setValue("n", n);
        var at = Time.now().value();
        var s = { "id" => at.format("%d") + "-" + n.format("%d"), "type" => type, "at" => at } as Dictionary;
        if (valeur != null) { s.put("valeur", valeur); }
        Application.Storage.setValue("file", avecSaisie(lire(), s));
        Jour.compter(type, valeur);
    }

    function retirer(ids as Array) as Void {
        if (ids.size() == 0) { return; }
        Application.Storage.setValue("file", sans(lire(), ids));
    }
}

// Ce qui a été noté aujourd'hui sur la montre : [date, eau, séances, humeur (0 : aucune)].
module Jour {
    function date() as Number {
        var g = Gregorian.info(Time.now(), Time.FORMAT_SHORT);
        return (g.year as Number) * 10000 + (g.month as Number) * 100 + (g.day as Number);
    }

    function lire() as Array {
        var v = Application.Storage.getValue("jour");
        if (v instanceof Array && v.size() == 4 && v[0] == date()) { return v; }
        return [date(), 0, 0, 0];
    }

    function eau() as Number { return lire()[1] as Number; }
    function seances() as Number { return lire()[2] as Number; }
    function humeur() as Number { return lire()[3] as Number; }

    function compter(type as String, valeur as Number?) as Void {
        var j = lire();
        if (type.equals("eau")) { j[1] = (j[1] as Number) + 1; }
        else if (type.equals("seance")) { j[2] = (j[2] as Number) + 1; }
        else if (type.equals("humeur") && valeur != null) { j[3] = valeur; }
        Application.Storage.setValue("jour", j);
    }
}
