// Déroulé d'une séance : prêt → série (comptage) → repos (compte à rebours) → série … → fin.
// L'enregistrement de l'activité commence à la première série.
import Toybox.Activity;
import Toybox.ActivityRecording;
import Toybox.Application;
import Toybox.Attention;
import Toybox.FitContributor;
import Toybox.Lang;
import Toybox.Sensor;
import Toybox.System;
import Toybox.Timer;
import Toybox.WatchUi;

const ETAT_PRET = 0;
const ETAT_SERIE = 1;
const ETAT_REPOS = 2;
const ETAT_FIN = 3;

class Seance {

    var exercice as Number;
    var nom as String;
    var seriesVisees as Number;
    var repsVisees as Number;
    var repos as Number;            // secondes
    var etat as Number = ETAT_PRET;
    var series as Array<Number> = [] as Array<Number>;   // répétitions de chaque série terminée
    var compteur as Compteur;
    var debutEtat as Number = 0;    // System.getTimer() au début de la série ou du repos
    var session as ActivityRecording.Session? = null;
    var champLap as FitContributor.Field? = null;
    var champTotal as FitContributor.Field? = null;
    var minuteur as Timer.Timer;
    var alerteRepos as Boolean = false;
    var enregistree as Boolean = false;

    function initialize(ex as Number) {
        exercice = ex;
        nom = EX_NOMS[ex] as String;
        var cle = EX_CLES[ex] as String;
        seriesVisees = reglage(cle + "Series", ex == EX_TRACTIONS ? 5 : 4);
        repsVisees = reglage(cle + "Reps", ex == EX_TRACTIONS ? 7 : 15);
        repos = reglage(cle + "Repos", ex == EX_TRACTIONS ? 120 : 90);
        // Sensibilité : 0 basse, 1 normale, 2 haute (seuil minimum du mouvement en milli-g).
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
            if (compteur.reps == repsVisees) { vibrer(300); }
        }
        WatchUi.requestUpdate();
    }

    // ----- Déroulé -----------------------------------------------------------------------------------------

    function commencerSerie() as Void {
        // Un circuit = une série et le repos qui suit : on le ferme au début de la série suivante, pour que
        // les corrections faites pendant le repos soient dans le fichier.
        if (session == null) { demarrerEnregistrement(); }
        else if (series.size() > 0) { fermerCircuit(); }
        compteur.remettreAZero();
        etat = ETAT_SERIE;
        debutEtat = System.getTimer();
        ecouter();
        minuteur.start(method(:tic), 1000, true);
        WatchUi.requestUpdate();
    }

    function finirSerie() as Void {
        arreterEcoute();
        series.add(compteur.reps);
        etat = ETAT_REPOS;
        alerteRepos = false;
        debutEtat = System.getTimer();
        vibrer(150);
        WatchUi.requestUpdate();
    }

    function corriger(delta as Number) as Void {
        if (etat == ETAT_SERIE) {
            compteur.reps = compteur.reps + delta < 0 ? 0 : compteur.reps + delta;
        } else if (etat == ETAT_REPOS && series.size() > 0) {
            // Pendant le repos : on corrige la série qui vient de finir.
            var i = series.size() - 1;
            series[i] = series[i] + delta < 0 ? 0 : series[i] + delta;
        }
        WatchUi.requestUpdate();
    }

    function secondesEcoulees() as Number {
        return (System.getTimer() - debutEtat) / 1000;
    }

    function reposRestant() as Number {
        return repos - secondesEcoulees();
    }

    function tic() as Void {
        if (etat == ETAT_REPOS) {
            var r = reposRestant();
            if (r == 10) { vibrer(100); }
            if (r <= 0 && !alerteRepos) {
                alerteRepos = true;
                vibrer(600);
                if (Attention has :playTone) { Attention.playTone(Attention.TONE_ALERT_HI); }
            }
        }
        WatchUi.requestUpdate();
    }

    function total() as Number {
        var t = 0;
        for (var i = 0; i < series.size(); i++) { t += series[i]; }
        return t;
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
            { :mesgType => FitContributor.MESG_TYPE_SESSION, :units => "rép." });        s.start();
    }

    // Valeur du circuit en cours : répétitions de la dernière série (écrite quand le circuit se ferme).
    function majCircuit() as Void {
        if (champLap != null && series.size() > 0) { (champLap as FitContributor.Field).setData(series[series.size() - 1]); }
    }

    function fermerCircuit() as Void {
        if (session == null) { return; }
        majCircuit();
        (session as ActivityRecording.Session).addLap();
    }

    function terminer(garder as Boolean) as Void {
        if (etat == ETAT_SERIE) { finirSerie(); }
        arreterEcoute();
        minuteur.stop();
        etat = ETAT_FIN;
        if (session != null) {
            var s = session as ActivityRecording.Session;
            majCircuit();   // le dernier circuit est fermé par l'enregistrement
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

    // Garde la dernière séance de chaque exercice (affichée au début de la suivante).
    function memoriser() as Void {
        Application.Storage.setValue("derniere_" + (EX_CLES[exercice] as String), series);
    }

    function derniere() as Array<Number>? {
        var v = Application.Storage.getValue("derniere_" + (EX_CLES[exercice] as String));
        return v instanceof Array ? v as Array<Number> : null;
    }

    function vibrer(ms as Number) as Void {
        if (Attention has :vibrate) {
            Attention.vibrate([new Attention.VibeProfile(100, ms)] as Array<Attention.VibeProfile>);
        }
    }
}
