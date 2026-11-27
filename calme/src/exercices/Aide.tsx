// « Si ça ne va vraiment pas » : numéros d'aide (liens tel: cliquables) et signes pour consulter. Ton calme.
import { NUMEROS, SIGNES_CONSULTER } from "../core/contenu";
import { Carte } from "../ui";

export default function Aide({ intro }: { intro?: string }) {
  return (
    <div className="pile aide">
      <Carte titre="Si ça ne va vraiment pas" className="aide-carte">
        <p>{intro ?? "Tu n'as pas à traverser ça seul. Parler à quelqu'un, maintenant, peut vraiment aider."}</p>
        <ul className="numeros">
          {NUMEROS.map((n) => (
            <li key={n.tel}>
              <a className="numero" href={`tel:${n.tel}`}><b>{n.numero}</b><span>{n.nom}</span></a>
              <small className="muted">{n.detail}</small>
            </li>
          ))}
        </ul>
        <p className="petit">Tu peux aussi en parler à un proche en qui tu as confiance, à ton médecin traitant ou à un psychologue.</p>
      </Carte>
      <Carte titre="Quand en parler à un professionnel">
        <ul className="guide">{SIGNES_CONSULTER.map((s) => <li key={s}>{s}</li>)}</ul>
        <p className="muted petit">Calme est une app de bien-être : elle aide à souffler, elle ne soigne pas et ne remplace pas un professionnel.</p>
      </Carte>
    </div>
  );
}
