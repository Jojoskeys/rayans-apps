// Accueil : une carte par exercice (pictogramme, compteur du jour et de toujours) et un bouton Réglages.
// HAUT / BAS choisit, START lance (le chrono de la série 1 part tout de suite). Toucher une carte la lance aussi.
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.System;
import Toybox.WatchUi;

class AccueilVue extends WatchUi.View {

    var choix as Number = 0;   // 0 tractions, 1 pompes, 2 réglages
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
        fPetit = Dessin.police(h * 6 / 100, true);
    }

    function yCarte(h as Number, i as Number) as Number {
        return i == 0 ? h * 36 / 100 : h * 62 / 100;
    }

    function onShow() as Void {
        WatchUi.requestUpdate();   // totaux à jour au retour d'une séance
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        if (dc has :setAntiAlias) { dc.setAntiAlias(true); }
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        Dessin.texte(dc, cx, h * 12 / 100, fTitre as Graphics.FontType, "M U S C U", C_OR);

        var largeur = w * 78 / 100;
        var hauteur = h * 23 / 100;
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
            var detail = "auj. " + Totaux.aujourdhui(cle).format("%d") + "  ·  total " + Totaux.toujours(cle).format("%d");
            Dessin.texteGauche(dc, x0 + 100, y - hauteur * 17 / 100, fNom as Graphics.FontType, EX_NOMS[i] as String, actif ? Graphics.COLOR_WHITE : 0x8A8A8A);
            Dessin.texteGauche(dc, x0 + 100, y + hauteur * 22 / 100, fDetail as Graphics.FontType, detail, actif ? 0xB0B0B0 : 0x5E5E5E);
        }

        // Bouton Réglages
        var actifR = choix == 2;
        var lb = w * 42 / 100;
        var hb = h * 11 / 100;
        var yb = h * 84 / 100;
        dc.setColor(actifR ? 0x1C1C1C : C_CARTE, Graphics.COLOR_TRANSPARENT);
        dc.fillRoundedRectangle(cx - lb / 2, yb - hb / 2, lb, hb, hb / 2);
        if (actifR) {
            dc.setColor(C_OR, Graphics.COLOR_TRANSPARENT);
            dc.setPenWidth(3);
            dc.drawRoundedRectangle(cx - lb / 2, yb - hb / 2, lb, hb, hb / 2);
            dc.setPenWidth(1);
        }
        Dessin.texte(dc, cx, yb, fPetit as Graphics.FontType, "RÉGLAGES", actifR ? Graphics.COLOR_WHITE : 0x8A8A8A);
    }
}

class AccueilDelegue extends WatchUi.BehaviorDelegate {

    var vue as AccueilVue;

    function initialize(v as AccueilVue) {
        BehaviorDelegate.initialize();
        vue = v;
    }

    function changer(i as Number) as Void {
        vue.choix = (i + 3) % 3;
        WatchUi.requestUpdate();
    }

    function onNextPage() as Boolean { changer(vue.choix + 1); return true; }
    function onPreviousPage() as Boolean { changer(vue.choix - 1); return true; }

    function onSelect() as Boolean {
        ouvrir(vue.choix);
        return true;
    }

    function onTap(evt as WatchUi.ClickEvent) as Boolean {
        var y = evt.getCoordinates()[1];
        var h = System.getDeviceSettings().screenHeight;
        var i = y < h * 49 / 100 ? 0 : (y < h * 75 / 100 ? 1 : 2);
        vue.choix = i;
        ouvrir(i);
        return true;
    }

    function ouvrir(i as Number) as Void {
        if (i == 2) {
            Reglages.ouvrir();
            return;
        }
        var seance = new Seance(i);
        var v = new SeanceVue(seance);
        WatchUi.pushView(v, new SeanceDelegue(seance, v), WatchUi.SLIDE_LEFT);
        seance.demarrer();
    }
}
