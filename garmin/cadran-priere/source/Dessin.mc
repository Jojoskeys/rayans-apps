// Outils de dessin : polices vectorielles (Roboto Condensed) quand la montre les a, sinon polices système ;
// coordonnées polaires ; petites icônes (pas, cœur, batterie).
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

module Dessin {

    const CENTRE = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;

    // Police vectorielle de taille « px » (gras ou non), ou police système la plus proche.
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

    // Texte aligné à gauche ou à droite, centré verticalement.
    function texteAligne(dc as Graphics.Dc, x as Numeric, y as Numeric, f as Graphics.FontType, s as String, couleur as Number, droite as Boolean) as Void {
        dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y, f, s, (droite ? Graphics.TEXT_JUSTIFY_RIGHT : Graphics.TEXT_JUSTIFY_LEFT) | Graphics.TEXT_JUSTIFY_VCENTER);
    }

    // Angle (degrés, sens trigonométrique depuis 3 h) d'une minute du jour sur un cadran de 24 h :
    // midi en haut, 18 h à droite, minuit en bas, 6 h à gauche.
    function angle24(minute as Number) as Float {
        return 90.0 - (minute - 720).toFloat() * 360.0 / 1440.0;
    }

    function px(cx as Number, r as Float, a as Float) as Float {
        return cx + r * Math.cos(Math.toRadians(a)).toFloat();
    }

    function py(cy as Number, r as Float, a as Float) as Float {
        return cy - r * Math.sin(Math.toRadians(a)).toFloat();
    }

    function norm(a as Float) as Number {
        var n = a.toNumber() % 360;
        return n < 0 ? n + 360 : n;
    }

    // Arc d'un cadran de 24 h, de la minute m1 à m2 (sens horaire).
    function arc24(dc as Graphics.Dc, cx as Number, cy as Number, r as Number, m1 as Number, m2 as Number, couleur as Number) as Void {
        if (m1 <= -100000 || m2 <= -100000) { return; }
        var a1 = norm(angle24(m1));
        var a2 = norm(angle24(m2));
        if (a1 == a2) { return; }
        dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
        dc.drawArc(cx, cy, r, Graphics.ARC_CLOCKWISE, a1, a2);
    }

    // ----- Icônes (environ 16 px) ----------------------------------------------------------------------------

    function coeur(dc as Graphics.Dc, x as Number, y as Number, couleur as Number) as Void {
        dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
        dc.fillCircle(x - 4, y - 2, 5);
        dc.fillCircle(x + 4, y - 2, 5);
        dc.fillPolygon([[x - 9, y], [x + 9, y], [x, y + 9]]);
    }

    function batterie(dc as Graphics.Dc, x as Number, y as Number, niveau as Float, couleur as Number) as Void {
        dc.setColor(0x777777, Graphics.COLOR_TRANSPARENT);
        dc.setPenWidth(2);
        dc.drawRoundedRectangle(x - 11, y - 6, 20, 12, 3);
        dc.fillRectangle(x + 9, y - 3, 3, 6);
        dc.setPenWidth(1);
        var l = (16.0 * niveau / 100.0).toNumber();
        if (l < 1) { l = 1; }
        dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
        dc.fillRectangle(x - 9, y - 4, l, 8);
    }

    function pas(dc as Graphics.Dc, x as Number, y as Number, couleur as Number) as Void {
        dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
        dc.fillEllipse(x - 4, y + 1, 3, 6);
        dc.fillEllipse(x + 4, y - 3, 3, 6);
        dc.fillCircle(x - 4, y + 9, 2);
        dc.fillCircle(x + 4, y + 5, 2);
    }

    // Enveloppe (notifications).
    function enveloppe(dc as Graphics.Dc, x as Number, y as Number, couleur as Number) as Void {
        dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
        dc.setPenWidth(2);
        dc.drawRoundedRectangle(x - 9, y - 6, 18, 13, 2);
        dc.drawLine(x - 8, y - 5, x, y + 1);
        dc.drawLine(x, y + 1, x + 8, y - 5);
        dc.setPenWidth(1);
    }

    // Éclair (Body Battery).
    function eclair(dc as Graphics.Dc, x as Number, y as Number, couleur as Number) as Void {
        dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
        dc.fillPolygon([[x + 3, y - 11], [x - 6, y + 2], [x - 1, y + 2], [x - 3, y + 11], [x + 6, y - 2], [x + 1, y - 2]]);
    }

    // Petit bonhomme à la barre (Muscu).
    function traction(dc as Graphics.Dc, x as Number, y as Number, couleur as Number) as Void {
        dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
        dc.fillRoundedRectangle(x - 10, y - 12, 20, 3, 1);
        dc.setPenWidth(2);
        dc.drawLine(x - 6, y - 10, x - 3, y - 2);
        dc.drawLine(x + 6, y - 10, x + 3, y - 2);
        dc.drawLine(x, y - 1, x, y + 6);
        dc.drawLine(x, y + 6, x - 3, y + 11);
        dc.drawLine(x, y + 6, x + 3, y + 11);
        dc.setPenWidth(1);
        dc.fillCircle(x, y - 4, 3);
    }

    // Météo selon la condition de Garmin (Weather.CONDITION_*) : soleil ou lune, nuage, pluie, neige, orage.
    function meteo(dc as Graphics.Dc, x as Number, y as Number, cond as Number, jour as Boolean, couleur as Number) as Void {
        var clair = cond == 0 || cond == 22 || cond == 23 || cond == 40;
        var peuNuageux = cond == 1;
        var orage = cond == 6 || cond == 12 || cond == 28 || cond == 32;
        var neige = cond == 4 || cond == 7 || cond == 10 || (cond >= 16 && cond <= 19) || cond == 21 || cond == 34 || cond == 43 || cond == 44 || (cond >= 46 && cond <= 51);
        var sec = cond == 2 || cond == 5 || cond == 8 || cond == 9 || cond == 20 || cond == 29 || cond == 30 || cond == 33 || (cond >= 35 && cond <= 39) || cond < 0;
        var pluie = !clair && !peuNuageux && !orage && !neige && !sec;
        if (clair || peuNuageux) {
            var sx = peuNuageux ? x - 3 : x;
            var sy = peuNuageux ? y - 4 : y;
            if (jour) {
                dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
                dc.fillCircle(sx, sy, 5);
                dc.setPenWidth(2);
                for (var k = 0; k < 8; k++) {
                    var a = k * 45.0;
                    dc.drawLine(px(sx, 7.5, a), py(sy, 7.5, a), px(sx, 10.0, a), py(sy, 10.0, a));
                }
                dc.setPenWidth(1);
            } else {
                dc.setColor(0xD8D8E8, Graphics.COLOR_TRANSPARENT);
                dc.fillCircle(sx, sy, 7);
                dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_TRANSPARENT);
                dc.fillCircle(sx + 4, sy - 3, 6);
            }
            if (clair) { return; }
        }
        // Nuage, puis pluie, neige ou éclair dessous.
        var yn = (pluie || neige || orage) ? y - 3 : y + 1;
        dc.setColor(0xC8C8C8, Graphics.COLOR_TRANSPARENT);
        dc.fillCircle(x - 4, yn + 1, 5);
        dc.fillCircle(x + 2, yn - 2, 6);
        dc.fillCircle(x + 7, yn + 2, 4);
        dc.fillRoundedRectangle(x - 9, yn + 1, 20, 6, 3);
        if (pluie) {
            dc.setColor(0x5AB4FF, Graphics.COLOR_TRANSPARENT);
            dc.setPenWidth(2);
            dc.drawLine(x - 5, yn + 9, x - 7, yn + 13);
            dc.drawLine(x, yn + 9, x - 2, yn + 13);
            dc.drawLine(x + 5, yn + 9, x + 3, yn + 13);
            dc.setPenWidth(1);
        } else if (neige) {
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.fillCircle(x - 5, yn + 11, 2);
            dc.fillCircle(x + 1, yn + 13, 2);
            dc.fillCircle(x + 6, yn + 10, 2);
        } else if (orage) {
            dc.setColor(couleur, Graphics.COLOR_TRANSPARENT);
            dc.fillPolygon([[x + 1, yn + 7], [x - 4, yn + 13], [x, yn + 13], [x - 2, yn + 18], [x + 4, yn + 11], [x, yn + 11]]);
        }
    }
}
