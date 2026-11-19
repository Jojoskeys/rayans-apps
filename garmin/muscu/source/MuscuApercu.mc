// Aperçu de Rayan's Muscu dans la liste des widgets : répétitions du jour par exercice (chiffres en grand),
// sinon la dernière séance de tractions.
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

(:glance)
class MuscuApercu extends WatchUi.GlanceView {

    function initialize() {
        GlanceView.initialize();
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var h = dc.getHeight();
        var w = dc.getWidth();
        var cy = h / 2;
        var gauche = Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER;
        if (dc has :setAntiAlias) { dc.setAntiAlias(true); }

        dc.setColor(0xF2B544, Graphics.COLOR_TRANSPARENT);
        dc.drawText(0, cy - h / 4, Graphics.FONT_GLANCE, "MUSCU", gauche);

        var t = Totaux.aujourdhui("tractions");
        var p = Totaux.aujourdhui("pompes");
        var y = cy + h / 6;
        if (t + p == 0) {
            var d = Totaux.derniere("tractions");
            var txt = d != null && d.size() > 0 ? "Dernière " + d.size().format("%d") + " × " + (d[0] as Number).format("%d") : "Pas encore";
            dc.setColor(0xA0A0A0, Graphics.COLOR_TRANSPARENT);
            dc.drawText(0, y, Graphics.FONT_GLANCE, txt, gauche);
            return;
        }

        // « 14 tractions  30 pompes » : chiffres en grand, mots en petit ; mots abrégés si ça ne tient pas.
        var grand = Graphics.FONT_GLANCE_NUMBER;
        var petit = Graphics.FONT_GLANCE;
        var nombres = [] as Array<String>;
        var mots = [] as Array<String>;
        var courts = [] as Array<String>;
        if (t > 0) { nombres.add(t.format("%d")); mots.add(" tractions"); courts.add(" tr."); }
        if (p > 0) { nombres.add(p.format("%d")); mots.add(" pompes"); courts.add(" pp."); }
        var largeur = 0;
        for (var i = 0; i < nombres.size(); i++) {
            largeur += dc.getTextWidthInPixels(nombres[i], grand) + dc.getTextWidthInPixels(mots[i] + "   ", petit);
        }
        if (largeur > w) { mots = courts; }
        var x = 0;
        for (var i = 0; i < nombres.size(); i++) {
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(x, y, grand, nombres[i], gauche);
            x += dc.getTextWidthInPixels(nombres[i], grand);
            dc.setColor(0xA0A0A0, Graphics.COLOR_TRANSPARENT);
            dc.drawText(x, y + 2, petit, mots[i], gauche);
            x += dc.getTextWidthInPixels(mots[i] + "   ", petit);
        }
    }
}
