// Accueil : deux grandes cartes (tractions, pompes) avec pictogramme, programme et dernière séance.
// HAUT / BAS (ou glisser) choisit, START (ou toucher la carte) lance.
import Toybox.Application;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.System;
import Toybox.WatchUi;

class AccueilVue extends WatchUi.View {

    var choix as Number = 0;
    var fTitre as Graphics.FontType?;
    var fNom as Graphics.FontType?;
    var fDetail as Graphics.FontType?;
    var fPetit as Graphics.FontType?;

    function initialize() {
        View.initialize();
    }

    function onLayout(dc as Graphics.Dc) as Void {
        var h = dc.getHeight();
        fTitre = Dessin.police(h * 6 / 100, true);
        fNom = Dessin.police(h * 10 / 100, true);
        fDetail = Dessin.police(h * 6 / 100, false);
        fPetit = Dessin.police(h * 5 / 100, false);
    }

    // Centre vertical de la carte i.
    function yCarte(h as Number, i as Number) as Number {
        return i == 0 ? h * 40 / 100 : h * 67 / 100;
    }

    function derniere(ex as Number) as Array<Number>? {
        var v = Application.Storage.getValue("derniere_" + (EX_CLES[ex] as String));
        return v instanceof Array ? v as Array<Number> : null;
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        if (dc has :setAntiAlias) { dc.setAntiAlias(true); }
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        Dessin.texte(dc, cx, h * 15 / 100, fTitre as Graphics.FontType, "M U S C U", C_OR);

        var largeur = w * 76 / 100;
        var hauteur = h * 24 / 100;
        for (var i = 0; i < 2; i++) {
            var actif = i == choix;
            var y = yCarte(h, i);
            var x0 = cx - largeur / 2;
            dc.setColor(actif ? 0x1C1C1C : C_CARTE, Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(x0, y - hauteur / 2, largeur, hauteur, 24);
            if (actif) {
                dc.setColor(C_OR, Graphics.COLOR_TRANSPARENT);
                dc.setPenWidth(3);
                dc.drawRoundedRectangle(x0, y - hauteur / 2, largeur, hauteur, 24);
                dc.setPenWidth(1);
            }
            Dessin.pictogramme(dc, i, x0 + 52, y - 4, actif ? C_OR : 0x5A5A5A);
            var cle = EX_CLES[i] as String;
            var detail = reglage(cle + "Series", i == EX_TRACTIONS ? 5 : 4).format("%d") + " × "
                + reglage(cle + "Reps", i == EX_TRACTIONS ? 7 : 15).format("%d") + "  ·  "
                + Dessin.mmss(reglage(cle + "Repos", i == EX_TRACTIONS ? 120 : 90));
            Dessin.texteGauche(dc, x0 + 100, y - hauteur * 17 / 100, fNom as Graphics.FontType, EX_NOMS[i] as String, actif ? Graphics.COLOR_WHITE : 0x8A8A8A);
            Dessin.texteGauche(dc, x0 + 100, y + hauteur * 22 / 100, fDetail as Graphics.FontType, detail, actif ? 0xB0B0B0 : 0x5E5E5E);
        }

        var d = derniere(choix);
        Dessin.texte(dc, cx, h * 88 / 100, fPetit as Graphics.FontType,
            d != null && d.size() > 0 ? "Dernière fois : " + Dessin.liste(d) : "START pour commencer", C_GRIS);
    }
}

class AccueilDelegue extends WatchUi.BehaviorDelegate {

    var vue as AccueilVue;

    function initialize(v as AccueilVue) {
        BehaviorDelegate.initialize();
        vue = v;
    }

    function changer(i as Number) as Void {
        vue.choix = i;
        WatchUi.requestUpdate();
    }

    function onNextPage() as Boolean { changer(1); return true; }
    function onPreviousPage() as Boolean { changer(0); return true; }

    function onSelect() as Boolean {
        lancer(vue.choix);
        return true;
    }

    function onTap(evt as WatchUi.ClickEvent) as Boolean {
        var y = evt.getCoordinates()[1];
        var h = System.getDeviceSettings().screenHeight;
        var i = y < h * 54 / 100 ? 0 : 1;
        if (i != vue.choix) { changer(i); } else { lancer(i); }
        return true;
    }

    function lancer(ex as Number) as Void {
        var seance = new Seance(ex);
        var v = new SeanceVue(seance);
        WatchUi.pushView(v, new SeanceDelegue(seance, v), WatchUi.SLIDE_LEFT);
    }
}
