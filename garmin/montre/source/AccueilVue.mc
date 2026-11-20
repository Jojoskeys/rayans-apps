// Écran principal : pas du jour, cœur récent, distance, calories ; ce qui a été noté aujourd'hui ; état de l'envoi.
// START (ou toucher l'écran) ouvre le menu de saisie. RETOUR quitte.
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Timer;
import Toybox.WatchUi;

const C_OR = 0xF2B544;
const C_BLEU = 0x4DD0E1;
const C_GRIS = 0x8C8C8C;
const CENTRE = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;

class AccueilVue extends WatchUi.View {

    var minuteur as Timer.Timer?;

    function initialize() {
        View.initialize();
    }

    function onShow() as Void {
        minuteur = new Timer.Timer();
        (minuteur as Timer.Timer).start(method(:tic), 5000, true);   // cœur et pas à jour
        WatchUi.requestUpdate();
    }

    function onHide() as Void {
        if (minuteur != null) { (minuteur as Timer.Timer).stop(); minuteur = null; }
    }

    function tic() as Void {
        WatchUi.requestUpdate();
    }

    function texte(dc as Graphics.Dc, x as Number, y as Number, f as Graphics.FontType, s as String, c as Number) as Void {
        dc.setColor(c, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y, f, s, CENTRE);
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        if (dc has :setAntiAlias) { dc.setAntiAlias(true); }
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        texte(dc, cx, h * 13 / 100, Graphics.FONT_XTINY, "M O N T R E", C_OR);
        texte(dc, cx, h * 29 / 100, Graphics.FONT_NUMBER_MEDIUM, Mesures.texte(Mesures.pas()), Graphics.COLOR_WHITE);
        texte(dc, cx, h * 42 / 100, Graphics.FONT_XTINY, "pas aujourd'hui", C_GRIS);

        texte(dc, w * 30 / 100, h * 53 / 100, Graphics.FONT_SMALL, Mesures.texte(Mesures.coeur()), Graphics.COLOR_WHITE);
        texte(dc, w * 30 / 100, h * 61 / 100, Graphics.FONT_XTINY, "coeur", C_GRIS);
        texte(dc, w * 70 / 100, h * 53 / 100, Graphics.FONT_SMALL, Mesures.texteDistance(Mesures.distance()), Graphics.COLOR_WHITE);
        texte(dc, w * 70 / 100, h * 61 / 100, Graphics.FONT_XTINY, "distance", C_GRIS);
        var kcal = Mesures.calories();
        texte(dc, cx, h * 70 / 100, Graphics.FONT_XTINY, kcal == null ? "-- kcal" : kcal.format("%d") + " kcal", Graphics.COLOR_WHITE);

        var hu = Jour.humeur();
        var note = "Eau " + Jour.eau().format("%d") + (Jour.seances() > 0 ? "  ·  Séance faite" : "") + (hu > 0 ? "  ·  Humeur " + hu.format("%d") : "");
        texte(dc, cx, h * 79 / 100, Graphics.FONT_XTINY, note, C_BLEU);

        var n = Attente.lire().size();
        var e = envoyeur();
        // En attente : le dernier envoi a échoué (détail : menu → Tester la connexion).
        var bas = e.enCours ? "Envoi..." : (n > 0 ? n.format("%d") + " en attente" : e.etat);
        texte(dc, cx, h * 88 / 100, Graphics.FONT_XTINY, bas.length() > 0 ? bas : "START : noter", C_GRIS);
    }
}

class AccueilDelegue extends WatchUi.BehaviorDelegate {

    function initialize() {
        BehaviorDelegate.initialize();
    }

    function onSelect() as Boolean {
        Saisie.ouvrir();
        return true;
    }

    function onTap(evt as WatchUi.ClickEvent) as Boolean {
        Saisie.ouvrir();
        return true;
    }
}
