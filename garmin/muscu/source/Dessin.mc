// Outils de dessin de Rayan's Muscu : polices vectorielles (Roboto Condensed) quand la montre les a, sinon
// polices système ; anneau de progression ; points de séries ; pictogrammes tractions et pompes.
import Toybox.Graphics;
import Toybox.Lang;

const C_OR = 0xF2B544;
const C_VERT = 0x3DDC84;
const C_BLEU = 0x4DD0E1;
const C_GRIS = 0x8C8C8C;
const C_PISTE = 0x1E1E1E;
const C_CARTE = 0x141414;

module Dessin {

    const CENTRE = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;

    function police(px as Number, gras as Boolean) as Graphics.FontType {
        if (Graphics has :getVectorFont) {
            var f = Graphics.getVectorFont({
                :face => gras ? ["RobotoCondensedBold", "RobotoRegular"] : ["RobotoCondensedRegular", "RobotoRegular"],
                :size => px
            });
            if (f != null) { return f; }
        }
        if (px >= 100) { return Graphics.FONT_NUMBER_THAI_HOT; }
        if (px >= 70) { return Graphics.FONT_NUMBER_HOT; }
        if (px >= 44) { return Graphics.FONT_NUMBER_MEDIUM; }
        if (px >= 34) { return Graphics.FONT_MEDIUM; }
        if (px >= 26) { return Graphics.FONT_SMALL; }
        if (px >= 21) { return Graphics.FONT_TINY; }
        return Graphics.FONT_XTINY;
    }

    function texte(dc as Graphics.Dc, x as Numeric, y as Numeric, f as Graphics.FontType, s as String, couleur as Number) as Void {
        dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y, f, s, CENTRE);
    }

    function texteGauche(dc as Graphics.Dc, x as Numeric, y as Numeric, f as Graphics.FontType, s as String, couleur as Number) as Void {
        dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y, f, s, Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);
    }

    // Anneau au bord de l'écran : piste sombre, puis la part « frac » (0..1) en couleur, depuis midi, sens horaire.
    function anneau(dc as Graphics.Dc, frac as Float, couleur as Number) as Void {
        var cx = dc.getWidth() / 2;
        var cy = dc.getHeight() / 2;
        var r = cx - 10;
        dc.setPenWidth(12);
        dc.setColor(C_PISTE, Graphics.COLOR_TRANSPARENT);
        dc.drawCircle(cx, cy, r);
        if (frac > 0.0) {
            dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
            if (frac >= 0.999) {
                dc.drawCircle(cx, cy, r);
            } else {
                var fin = 90 - (frac * 360.0).toNumber();
                dc.drawArc(cx, cy, r, Graphics.ARC_CLOCKWISE, 90, ((fin % 360) + 360) % 360);
            }
        }
        dc.setPenWidth(1);
    }

    // Points des séries : faites (pleines, or), en cours (cerclée blanche), à venir (sombres).
    function points(dc as Graphics.Dc, cx as Number, y as Number, faites as Number, total as Number, enCours as Boolean) as Void {
        var n = total > faites ? total : faites;
        if (enCours && faites + 1 > n) { n = faites + 1; }
        var pasX = n > 8 ? 16 : 22;
        var x = cx - (n - 1) * pasX / 2;
        for (var i = 0; i < n; i++) {
            if (i < faites) {
                dc.setColor(C_OR, Graphics.COLOR_TRANSPARENT);
                dc.fillCircle(x, y, 6);
            } else if (enCours && i == faites) {
                dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
                dc.setPenWidth(2);
                dc.drawCircle(x, y, 6);
                dc.setPenWidth(1);
            } else {
                dc.setColor(0x333333, Graphics.COLOR_TRANSPARENT);
                dc.fillCircle(x, y, 5);
            }
            x += pasX;
        }
    }

    // Pictogramme : silhouette à la barre (tractions) ou en appui au sol (pompes), environ 60 × 50 px.
    function pictogramme(dc as Graphics.Dc, ex as Number, x as Number, y as Number, couleur as Number) as Void {
        dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
        if (ex == EX_TRACTIONS) {
            dc.setPenWidth(4);
            dc.drawLine(x - 28, y - 22, x + 28, y - 22);       // barre
            dc.setPenWidth(5);
            dc.drawLine(x - 14, y - 20, x - 8, y + 2);         // bras
            dc.drawLine(x + 14, y - 20, x + 8, y + 2);
            dc.drawLine(x, y + 2, x, y + 20);                  // tronc
            dc.drawLine(x - 8, y + 2, x + 8, y + 2);           // épaules
            dc.setPenWidth(4);
            dc.drawLine(x, y + 20, x - 6, y + 32);             // jambes
            dc.drawLine(x, y + 20, x + 6, y + 32);
            dc.fillCircle(x, y - 8, 6);                        // tête
        } else {
            dc.setPenWidth(2);
            dc.setColor(0x555555, Graphics.COLOR_TRANSPARENT);
            dc.drawLine(x - 32, y + 22, x + 32, y + 22);       // sol
            dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
            dc.setPenWidth(5);
            dc.drawLine(x - 26, y + 18, x + 12, y);            // corps gainé
            dc.drawLine(x + 12, y, x + 12, y + 20);            // bras
            dc.fillCircle(x + 22, y - 6, 6);                   // tête
        }
        dc.setPenWidth(1);
    }

    function mmss(s as Number) as String {
        var a = s < 0 ? -s : s;
        return (s < 0 ? "+" : "") + (a / 60).format("%d") + ":" + (a % 60).format("%02d");
    }

    function liste(series as Array<Number>) as String {
        var s = "";
        for (var i = 0; i < series.size(); i++) { s += (i > 0 ? " · " : "") + series[i].format("%d"); }
        return s;
    }
}
