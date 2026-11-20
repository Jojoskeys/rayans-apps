// « Tester la connexion » : envoi vide vers le PC (rien n'est enregistré), puis OK ou l'erreur en clair.
// À faire en premier après l'installation (voir garmin/README.md). START relance le test, RETOUR revient.
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

class TestVue extends WatchUi.View {

    var message as String = "Test en cours...\nmontre > iPhone > PC";
    var ok as Boolean? = null;

    function initialize() {
        View.initialize();
    }

    function resultat(reussi as Boolean, texte as String) as Void {
        ok = reussi;
        message = texte;
        WatchUi.requestUpdate();
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();
        var titre = ok == null ? "CONNEXION" : (ok ? "OK" : "ÉCHEC");
        var couleur = ok == null ? C_OR : (ok ? 0x3DDC84 : 0xFF5A4F);
        dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 22 / 100, Graphics.FONT_SMALL, titre, CENTRE);
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 55 / 100, Graphics.FONT_XTINY, message, CENTRE);
    }
}

class TestDelegue extends WatchUi.BehaviorDelegate {

    function initialize() {
        BehaviorDelegate.initialize();
    }

    // START : relancer le test (nouvelle vue, l'ancienne est remplacée).
    function onSelect() as Boolean {
        var v = new TestVue();
        WatchUi.switchToView(v, new TestDelegue(), WatchUi.SLIDE_IMMEDIATE);
        envoyeur().tester(v.method(:resultat));
        return true;
    }
}
