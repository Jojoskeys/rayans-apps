// Séance libre, comme une course : le chrono de la série 1 part dès qu'on choisit l'exercice ; START passe de la
// série (répétitions comptées) à la pause (chrono qui monte), puis de la pause à la série suivante ; RETOUR
// termine (enregistrer, reprendre, supprimer). Une série = l'effort et la pause qui suit (un circuit dans le
// fichier de l'activité, avec ses répétitions). Objectif par série et rappel de pause : facultatifs (réglages).
import Toybox.Activity;
import Toybox.ActivityRecording;
import Toybox.Application;
import Toybox.Attention;
import Toybox.FitContributor;
import Toybox.Lang;
import Toybox.Sensor;
import Toybox.System;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.Timer;
import Toybox.WatchUi;

const ETAT_SERIE = 1;
const ETAT_REPOS = 2;
const ETAT_FIN = 3;

class Seance {

    var exercice as Number;
    var nom as String;
    var objectif as Number;          // répétitions visées par série, 0 = libre
    var rappel as Number;            // secondes de pause avant une vibration, 0 = aucun rappel
    var etat as Number = ETAT_SERIE;
    var series as Array<Number> = [] as Array<Number>;   // répétitions de chaque série terminée
    var compteur as Compteur;
    var debutEtat as Number = 0;     // System.getTimer() au début de la série ou de la pause
    var debutSeance as Number = 0;
    var dureeTotale as Number = 0;   // secondes, figée à la fin
    var session as ActivityRecording.Session? = null;
    var champLap as FitContributor.Field? = null;
    var champTotal as FitContributor.Field? = null;
    var minuteur as Timer.Timer;
    var alerteFaite as Boolean = false;
    var enregistree as Boolean = false;

    function initialize(ex as Number) {
        exercice = ex;
        nom = EX_NOMS[ex] as String;
        var cle = EX_CLES[ex] as String;
        objectif = reglage(cle + "Objectif", ex == EX_TRACTIONS ? 7 : 15);
        rappel = reglage(cle + "Rappel", 0);
        // Sensibilité : 0 basse, 1 normale, 2 haute (amplitude minimale du mouvement en milli-g).
        var sens = reglage("sensibilite", 1);
        var seuil = sens == 0 ? 55.0 : (sens == 2 ? 18.0 : 30.0);
        compteur = new Compteur(seuil, EX_INTERVALLE[ex] as Float);
        minuteur = new Timer.Timer();
        Sensor.setEnabledSensors([Sensor.SENSOR_HEARTRATE] as Array<Sensor.SensorType>);
    }

    // ----- Capteur ---------------------------------------------------------------------------------------

    function ecouter() as Void {
        Sensor.registerSensorDataListener(method(:onDonnees), {
            :period => 1,
            :accelerometer => { :enabled => true, :sampleRate => 25 }
        });
    }

    function arreterEcoute() as Void {
        Sensor.unregisterSensorDataListener();
    }

    function onDonnees(d as Sensor.SensorData) as Void {
        if (etat != ETAT_SERIE) { return; }
        var acc = d.accelerometerData;
        if (acc == null) { return; }
        var xs = acc.x; var ys = acc.y; var zs = acc.z;
        var nouvelle = false;
        for (var i = 0; i < xs.size(); i++) {
            if (compteur.mesure(xs[i], ys[i], zs[i])) { nouvelle = true; }
        }
        if (nouvelle) {
            vibrer(40);
            if (objectif > 0 && compteur.reps == objectif) { vibrer(300); }
        }
        WatchUi.requestUpdate();
    }

    // ----- Déroulé -----------------------------------------------------------------------------------------

    // Choix de l'exercice : l'activité et le chrono de la série 1 partent tout de suite.
    function demarrer() as Void {
        debutSeance = System.getTimer();
        demarrerEnregistrement();
        commencerSerie();
        minuteur.start(method(:tic), 1000, true);
    }

    // START : série → pause, ou pause → série suivante.
    function basculer() as Void {
        if (etat == ETAT_SERIE) { finirSerie(); }
        else if (etat == ETAT_REPOS) { commencerSerie(); }
    }

    function commencerSerie() as Void {
        if (series.size() > 0) { fermerCircuit(); }
        compteur.remettreAZero();
        etat = ETAT_SERIE;
        debutEtat = System.getTimer();
        ecouter();
        WatchUi.requestUpdate();
    }

    function finirSerie() as Void {
        arreterEcoute();
        series.add(compteur.reps);
        etat = ETAT_REPOS;
        alerteFaite = false;
        debutEtat = System.getTimer();
        vibrer(150);
        WatchUi.requestUpdate();
    }

    // HAUT / BAS : pendant la série, le compte en cours ; pendant la pause, la série qui vient de finir.
    function corriger(delta as Number) as Void {
        if (etat == ETAT_SERIE) {
            compteur.reps = compteur.reps + delta < 0 ? 0 : compteur.reps + delta;
        } else if (etat == ETAT_REPOS && series.size() > 0) {
            var i = series.size() - 1;
            series[i] = series[i] + delta < 0 ? 0 : series[i] + delta;
        }
        WatchUi.requestUpdate();
    }

    function secondesEcoulees() as Number {
        return (System.getTimer() - debutEtat) / 1000;
    }

    function secondesSeance() as Number {
        return etat == ETAT_FIN ? dureeTotale : (System.getTimer() - debutSeance) / 1000;
    }

    function tic() as Void {
        if (etat == ETAT_REPOS && rappel > 0 && !alerteFaite && secondesEcoulees() >= rappel) {
            alerteFaite = true;
            vibrer(600);
            if (Attention has :playTone) { Attention.playTone(Attention.TONE_ALERT_HI); }
        }
        WatchUi.requestUpdate();
    }

    // Répétitions de la séance, série en cours comprise.
    function total() as Number {
        var t = 0;
        for (var i = 0; i < series.size(); i++) { t += series[i]; }
        return etat == ETAT_SERIE ? t + compteur.reps : t;
    }

    function meilleure() as Number {
        var m = 0;
        for (var i = 0; i < series.size(); i++) { if (series[i] > m) { m = series[i]; } }
        return m;
    }

    // ----- Enregistrement de l'activité --------------------------------------------------------------------

    function demarrerEnregistrement() as Void {
        if (!(Toybox has :ActivityRecording)) { return; }
        session = ActivityRecording.createSession({
            :name => nom,
            :sport => Activity.SPORT_TRAINING,
            :subSport => Activity.SUB_SPORT_STRENGTH_TRAINING
        });
        var s = session as ActivityRecording.Session;
        champLap = s.createField("repetitions", 0, FitContributor.DATA_TYPE_UINT16,
            { :mesgType => FitContributor.MESG_TYPE_LAP, :units => "rép." });
        champTotal = s.createField("repetitions_total", 1, FitContributor.DATA_TYPE_UINT16,
            { :mesgType => FitContributor.MESG_TYPE_SESSION, :units => "rép." });
        s.start();
    }

    function majCircuit() as Void {
        if (champLap != null && series.size() > 0) { (champLap as FitContributor.Field).setData(series[series.size() - 1]); }
    }

    function fermerCircuit() as Void {
        if (session == null) { return; }
        majCircuit();
        (session as ActivityRecording.Session).addLap();
    }

    // Fin de séance. Une série en cours compte si elle a au moins une répétition.
    function terminer(garder as Boolean) as Void {
        if (etat == ETAT_SERIE) {
            arreterEcoute();
            if (compteur.reps > 0) { series.add(compteur.reps); }
        }
        arreterEcoute();
        minuteur.stop();
        dureeTotale = (System.getTimer() - debutSeance) / 1000;
        etat = ETAT_FIN;
        if (session != null) {
            var s = session as ActivityRecording.Session;
            majCircuit();
            if (s.isRecording()) { s.stop(); }
            if (garder && series.size() > 0) {
                if (champTotal != null) { (champTotal as FitContributor.Field).setData(total()); }
                s.save();
                enregistree = true;
                memoriser();
            } else {
                s.discard();
            }
            session = null;
        }
        WatchUi.requestUpdate();
    }

    // Dernière séance, total de toujours et total du jour de l'exercice.
    function memoriser() as Void {
        var cle = EX_CLES[exercice] as String;
        Application.Storage.setValue("derniere_" + cle, series);
        Totaux.ajouter(cle, total());
    }

    function vibrer(ms as Number) as Void {
        if (Attention has :vibrate) {
            Attention.vibrate([new Attention.VibeProfile(100, ms)] as Array<Attention.VibeProfile>);
        }
    }
}

// Compteurs de toujours et du jour, par exercice (stockés sur la montre).
module Totaux {
    function jour() as Number {
        var g = Gregorian.info(Time.now(), Time.FORMAT_SHORT);
        return (g.year as Number) * 10000 + (g.month as Number) * 100 + (g.day as Number);
    }

    function toujours(cle as String) as Number {
        var v = Application.Storage.getValue("total_" + cle);
        return v instanceof Number ? v : 0;
    }

    function aujourdhui(cle as String) as Number {
        var v = Application.Storage.getValue("jour_" + cle);
        if (v instanceof Array && v.size() == 2 && v[0] == jour()) { return v[1] as Number; }
        return 0;
    }

    function ajouter(cle as String, n as Number) as Void {
        Application.Storage.setValue("total_" + cle, toujours(cle) + n);
        Application.Storage.setValue("jour_" + cle, [jour(), aujourdhui(cle) + n]);
    }

    function derniere(cle as String) as Array<Number>? {
        var v = Application.Storage.getValue("derniere_" + cle);
        return v instanceof Array ? v as Array<Number> : null;
    }
}
