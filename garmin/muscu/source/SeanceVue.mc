// Écrans de la séance. L'anneau au bord : pendant la série, les répétitions vers l'objectif (or, vert une fois
// atteint) ou, sans objectif, la trotteuse du chrono ; pendant la pause, le temps vers le rappel (bleu, or quand
// c'est l'heure) ou la trotteuse.
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

class SeanceVue extends WatchUi.View {

    var seance as Seance;
    var fEtiquette as Graphics.FontType?;
    var fEnorme as Graphics.FontType?;
    var fGrand as Graphics.FontType?;
    var fMoyen as Graphics.FontType?;
    var fPetit as Graphics.FontType?;

    function initialize(s as Seance) {
        View.initialize();
        seance = s;
    }

    function onLayout(dc as Graphics.Dc) as Void {
        var h = dc.getHeight();
        fEtiquette = Dessin.police(h * 7 / 100, true);
        fEnorme = Dessin.police(h * 38 / 100, true);
        fGrand = Dessin.police(h * 26 / 100, true);
        fMoyen = Dessin.police(h * 9 / 100, false);
        fPetit = Dessin.police(h * 6 / 100, false);
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        if (dc has :setAntiAlias) { dc.setAntiAlias(true); }
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();
        var e = seance.etat;
        if (e == ETAT_SERIE) { serie(dc, cx, h); }
        else if (e == ETAT_REPOS) { pause(dc, cx, h); }
        else { fin(dc, cx, h); }
    }

    function trotteuse(s as Number) as Float {
        return ((s % 60) + 1).toFloat() / 60.0;
    }

    function serie(dc as Graphics.Dc, cx as Number, h as Number) as Void {
        var reps = seance.compteur.reps;
        var obj = seance.objectif;
        var atteint = obj > 0 && reps >= obj;
        var s = seance.secondesEcoulees();
        if (obj > 0) { Dessin.anneau(dc, reps.toFloat() / obj.toFloat(), atteint ? C_VERT : C_OR); }
        else { Dessin.anneau(dc, trotteuse(s), C_OR); }

        Dessin.texte(dc, cx, h * 15 / 100, fEtiquette as Graphics.FontType,
            seance.nom.toUpper() + "  ·  SÉRIE " + (seance.series.size() + 1).format("%d"), C_OR);
        Dessin.texte(dc, cx, h * 30 / 100, fMoyen as Graphics.FontType, Dessin.mmss(s), Graphics.COLOR_WHITE);
        Dessin.texte(dc, cx, h * 52 / 100, fEnorme as Graphics.FontType, reps.format("%d"), atteint ? C_VERT : Graphics.COLOR_WHITE);
        Dessin.texte(dc, cx, h * 70 / 100, fPetit as Graphics.FontType,
            (obj > 0 ? "objectif " + obj.format("%d") + "  ·  " : "") + "séance " + seance.total().format("%d"), C_GRIS);
        Dessin.texte(dc, cx, h * 82 / 100, fPetit as Graphics.FontType, "START : pause", C_BLEU);
    }

    function pause(dc as Graphics.Dc, cx as Number, h as Number) as Void {
        var s = seance.secondesEcoulees();
        var r = seance.rappel;
        var assez = r > 0 && s >= r;
        if (r > 0) { Dessin.anneau(dc, assez ? 1.0 : s.toFloat() / r.toFloat(), assez ? C_OR : C_BLEU); }
        else { Dessin.anneau(dc, trotteuse(s), C_BLEU); }

        var faites = seance.series.size();
        var derniere = faites > 0 ? seance.series[faites - 1] : 0;
        Dessin.texte(dc, cx, h * 16 / 100, fEtiquette as Graphics.FontType, "PAUSE", assez ? C_OR : C_BLEU);
        Dessin.texte(dc, cx, h * 38 / 100, fGrand as Graphics.FontType, Dessin.mmss(s), assez ? C_OR : Graphics.COLOR_WHITE);
        Dessin.texte(dc, cx, h * 56 / 100, fMoyen as Graphics.FontType,
            "série " + faites.format("%d") + " : " + derniere.format("%d") + " " + seance.nom.toLower(), 0xC8C8C8);
        Dessin.points(dc, cx, h * 67 / 100, faites, 0, false);
        Dessin.texte(dc, cx, h * 76 / 100, fPetit as Graphics.FontType, "total " + seance.total().format("%d"), C_GRIS);
        Dessin.texte(dc, cx, h * 86 / 100, fPetit as Graphics.FontType,
            "START : série " + (faites + 1).format("%d") + "  ·  RETOUR : fin", C_VERT);
    }

    function fin(dc as Graphics.Dc, cx as Number, h as Number) as Void {
        Dessin.anneau(dc, seance.enregistree ? 1.0 : 0.0, C_OR);
        Dessin.texte(dc, cx, h * 15 / 100, fPetit as Graphics.FontType,
            seance.enregistree ? "SÉANCE ENREGISTRÉE" : "NON ENREGISTRÉE", seance.enregistree ? C_VERT : C_GRIS);
        Dessin.texte(dc, cx, h * 31 / 100, fGrand as Graphics.FontType, seance.total().format("%d"), Graphics.COLOR_WHITE);
        var n = seance.series.size();
        Dessin.texte(dc, cx, h * 46 / 100, fPetit as Graphics.FontType,
            seance.nom.toLower() + "  ·  " + n.format("%d") + (n > 1 ? " séries" : " série") + "  ·  " + Dessin.mmss(seance.secondesSeance()), C_GRIS);

        // Histogramme des séries.
        if (n > 0) {
            var max = seance.meilleure();
            if (max < 1) { max = 1; }
            var larg = n > 8 ? 12 : (n > 5 ? 18 : 24);
            var ecart = n > 8 ? 6 : 10;
            var hMax = h * 16 / 100;
            var base = h * 71 / 100;
            var x = cx - (n * larg + (n - 1) * ecart) / 2;
            for (var i = 0; i < n; i++) {
                var v = seance.series[i];
                var hb = v * hMax / max;
                if (hb < 4) { hb = 4; }
                dc.setColor(v == max ? C_OR : 0x7A6232, Graphics.COLOR_TRANSPARENT);
                dc.fillRoundedRectangle(x, base - hb, larg, hb, 5);
                if (n <= 8) { Dessin.texte(dc, x + larg / 2, base + h * 4 / 100, fPetit as Graphics.FontType, v.format("%d"), 0xB0B0B0); }
                x += larg + ecart;
            }
        }
        if (seance.enregistree) {
            var cle = EX_CLES[seance.exercice] as String;
            Dessin.texte(dc, cx, h * 86 / 100, fPetit as Graphics.FontType,
                "aujourd'hui " + Totaux.aujourdhui(cle).format("%d") + "  ·  toujours " + Totaux.toujours(cle).format("%d"), C_OR);
        }
    }
}

class SeanceDelegue extends WatchUi.BehaviorDelegate {

    var seance as Seance;
    var vue as SeanceVue;

    function initialize(s as Seance, v as SeanceVue) {
        BehaviorDelegate.initialize();
        seance = s;
        vue = v;
    }

    function onSelect() as Boolean {
        if (seance.etat == ETAT_FIN) { WatchUi.popView(WatchUi.SLIDE_RIGHT); }
        else { seance.basculer(); }
        return true;
    }

    // Écran tactile ignoré pendant la séance (sol, transpiration) : seulement les boutons.
    function onTap(evt as WatchUi.ClickEvent) as Boolean { return true; }
    function onSwipe(evt as WatchUi.SwipeEvent) as Boolean { return true; }

    function onPreviousPage() as Boolean { seance.corriger(1); return true; }
    function onNextPage() as Boolean { seance.corriger(-1); return true; }

    function onBack() as Boolean {
        if (seance.etat == ETAT_FIN) { WatchUi.popView(WatchUi.SLIDE_RIGHT); return true; }
        var menu = new WatchUi.Menu2({ :title => "Fin de séance ?" });
        menu.addItem(new WatchUi.MenuItem("Enregistrer", seance.total().format("%d") + " " + seance.nom.toLower(), :garder, {}));
        menu.addItem(new WatchUi.MenuItem("Reprendre", null, :reprendre, {}));
        menu.addItem(new WatchUi.MenuItem("Supprimer", null, :supprimer, {}));
        WatchUi.pushView(menu, new MenuFin(seance), WatchUi.SLIDE_UP);
        return true;
    }
}

class MenuFin extends WatchUi.Menu2InputDelegate {
    var seance as Seance;

    function initialize(s as Seance) {
        Menu2InputDelegate.initialize();
        seance = s;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var id = item.getId();
        WatchUi.popView(WatchUi.SLIDE_DOWN);
        if (id == :garder) { seance.terminer(true); }
        else if (id == :supprimer) { seance.terminer(false); }
    }
}
