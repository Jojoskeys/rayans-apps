// Raccourci du cadran : Muscu publie une « complication » (répétitions du jour). Le cadran Rayan's Prière
// l'affiche et, par un appui long dessus, ouvre directement Muscu.
import Toybox.Lang;

module Raccourci {
    function publier() as Void {
        if (!(Toybox has :Complications) || !(Toybox.Complications has :updateComplication)) { return; }
        var n = Totaux.aujourdhui("tractions") + Totaux.aujourdhui("pompes");
        try {
            Toybox.Complications.updateComplication(0, { :value => n, :shortLabel => "MUSCU" });
        } catch (e) {
            // Montre sans complications publiées : rien à faire.
        }
    }
}
