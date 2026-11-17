// Écrans de la séance. Un anneau au bord de l'écran sert de jauge : répétitions vers l'objectif pendant la
// série (or, vert une fois l'objectif atteint), temps de repos qui se vide (bleu, or quand c'est l'heure).
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
        fEnorme = Dessin.police(h * 40 / 100, true);
        fGrand = Dessin.police(h * 26 / 100, true);
        fMoyen = Dessin.police(h * 8 / 100, false);
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
        if (e == ETAT_PRET) { pret(dc, cx, h); }
        else if (e == ETAT_SERIE) { serie(dc, cx, h); }
        else if (e == ETAT_REPOS) { repos(dc, cx, h); }
        else { fin(dc, cx, h); }
    }

    function pret(dc as Graphics.Dc, cx as Number, h as Number) as Void {
        Dessin.anneau(dc, 0.0, C_OR);
        Dessin.texte(dc, cx, h * 17 / 100, fEtiquette as Graphics.FontType, seance.nom.toUpper(), C_OR);
        Dessin.pictogramme(dc, seance.exercice, cx, h * 33 / 100, Graphics.COLOR_WHITE);
        Dessin.texte(dc, cx, h * 53 / 100, fGrand as Graphics.FontType,
            seance.seriesVisees.format("%d") + " × " + seance.repsVisees.format("%d"), Graphics.COLOR_WHITE);
        var d = seance.derniere();
        var info = "repos " + Dessin.mmss(seance.repos);
        if (d != null && d.size() > 0) { info += "  ·  avant : " + Dessin.liste(d); }
        Dessin.texte(dc, cx, h * 68 / 100, fPetit as Graphics.FontType, info, C_GRIS);
        // Bouton START
        var lb = 150;
        var hb = h * 12 / 100;
        var yb = h * 82 / 100;
        dc.setColor(C_VERT, Graphics.COLOR_TRANSPARENT);
        dc.fillRoundedRectangle(cx - lb / 2, yb - hb / 2, lb, hb, hb / 2);
        Dessin.texte(dc, cx, yb, fEtiquette as Graphics.FontType, "START", Graphics.COLOR_BLACK);
    }

    function serie(dc as Graphics.Dc, cx as Number, h as Number) as Void {
        var reps = seance.compteur.reps;
        var vise = seance.repsVisees;
        var atteint = reps >= vise;
        Dessin.anneau(dc, vise > 0 ? (reps.toFloat() / vise.toFloat()) : 0.0, atteint ? C_VERT : C_OR);
        Dessin.texte(dc, cx, h * 18 / 100, fMoyen as Graphics.FontType,
            "SÉRIE " + (seance.series.size() + 1).format("%d") + " / " + seance.seriesVisees.format("%d"), C_GRIS);
        Dessin.texte(dc, cx, h * 44 / 100, fEnorme as Graphics.FontType, reps.format("%d"), atteint ? C_VERT : Graphics.COLOR_WHITE);
        Dessin.texte(dc, cx, h * 64 / 100, fMoyen as Graphics.FontType, "objectif " + vise.format("%d"), C_GRIS);
        Dessin.points(dc, cx, h * 74 / 100, seance.series.size(), seance.seriesVisees, true);
        Dessin.texte(dc, cx, h * 84 / 100, fPetit as Graphics.FontType, Dessin.mmss(seance.secondesEcoulees()) + "   ·   HAUT/BAS ±1", 0x6A6A6A);
    }

    function repos(dc as Graphics.Dc, cx as Number, h as Number) as Void {
        var r = seance.reposRestant();
        var fini = r <= 0;
        Dessin.anneau(dc, fini ? 1.0 : r.toFloat() / seance.repos.toFloat(), fini ? C_OR : C_BLEU);
        var faites = seance.series.size();
        var restantes = seance.seriesVisees - faites;
        Dessin.texte(dc, cx, h * 18 / 100, fEtiquette as Graphics.FontType, fini ? "C'EST REPARTI" : "REPOS", fini ? C_OR : C_BLEU);
        Dessin.texte(dc, cx, h * 41 / 100, fGrand as Graphics.FontType, Dessin.mmss(r), fini ? C_OR : Graphics.COLOR_WHITE);
        var derniere = faites > 0 ? seance.series[faites - 1] : 0;
        Dessin.texte(dc, cx, h * 59 / 100, fMoyen as Graphics.FontType,
            "série " + faites.format("%d") + " : " + derniere.format("%d") + " rép.", 0xC8C8C8);
        Dessin.points(dc, cx, h * 70 / 100, faites, seance.seriesVisees, false);
        Dessin.texte(dc, cx, h * 82 / 100, fPetit as Graphics.FontType,
            restantes > 0 ? "START  ·  série " + (faites + 1).format("%d") : "Séries faites  ·  RETOUR", restantes > 0 ? C_VERT : C_OR);
    }

    function fin(dc as Graphics.Dc, cx as Number, h as Number) as Void {
        Dessin.anneau(dc, seance.enregistree ? 1.0 : 0.0, C_OR);
        Dessin.texte(dc, cx, h * 16 / 100, fPetit as Graphics.FontType,
            seance.enregistree ? "SÉANCE ENREGISTRÉE" : "NON ENREGISTRÉE", seance.enregistree ? C_VERT : C_GRIS);
        Dessin.texte(dc, cx, h * 33 / 100, fGrand as Graphics.FontType, seance.total().format("%d"), Graphics.COLOR_WHITE);
        Dessin.texte(dc, cx, h * 48 / 100, fPetit as Graphics.FontType, seance.nom.toLower() + " au total", C_GRIS);

        // Histogramme des séries.
        var n = seance.series.size();
        if (n == 0) { return; }
        var max = seance.meilleure();
        if (max < 1) { max = 1; }
        var larg = n > 6 ? 16 : 24;
        var ecart = n > 6 ? 8 : 12;
        var hMax = h * 18 / 100;
        var base = h * 76 / 100;
        var x = cx - (n * larg + (n - 1) * ecart) / 2;
        for (var i = 0; i < n; i++) {
            var v = seance.series[i];
            var hb = v * hMax / max;
            if (hb < 4) { hb = 4; }
            dc.setColor(v == max ? C_OR : 0x7A6232, Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(x, base - hb, larg, hb, 5);
            Dessin.texte(dc, x + larg / 2, base + h * 5 / 100, fPetit as Graphics.FontType, v.format("%d"), 0xB0B0B0);
            x += larg + ecart;
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
        var e = seance.etat;
        if (e == ETAT_PRET || e == ETAT_REPOS) { seance.commencerSerie(); }
        else if (e == ETAT_SERIE) { seance.finirSerie(); }
        else { WatchUi.popView(WatchUi.SLIDE_RIGHT); }
        return true;
    }

    function onPreviousPage() as Boolean { seance.corriger(1); return true; }
    function onNextPage() as Boolean { seance.corriger(-1); return true; }

    function onBack() as Boolean {
        if (seance.etat == ETAT_FIN) { WatchUi.popView(WatchUi.SLIDE_RIGHT); return true; }
        if (seance.etat == ETAT_PRET && seance.series.size() == 0) {
            seance.terminer(false);
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
            return true;
        }
        var menu = new WatchUi.Menu2({ :title => "Fin de séance ?" });
        menu.addItem(new WatchUi.MenuItem("Enregistrer", null, :garder, {}));
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
