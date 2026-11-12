/**
 * Paquet d'exemple créé au premier démarrage. Les trois premières questions viennent de questions.txt
 * du projet quiz-revision (format « question;réponse »).
 */
import { emptyDb, makeCard, makeDeck, type CardDraft, type Db } from "./model";

export const SAMPLE_CARDS: CardDraft[] = [
  { kind: "basic", question: "Quel mot-clé Java crée un objet ?", answer: "new" },
  { kind: "basic", question: "Combien d'octets occupe un int en Java ?", answer: "4|quatre" },
  { kind: "basic", question: "Quelle commande Git envoie les commits vers GitHub ?", answer: "git push" },
  {
    kind: "mcq",
    question: "Quelle commande Git crée un commit ?",
    answer: "git commit",
    choices: ["git commit", "git push", "git add", "git clone"],
    explanation: "git add prépare les fichiers, git commit les enregistre, git push les envoie.",
  },
  {
    kind: "cloze",
    question: "En Java, le point d'entrée d'un programme est la méthode {{main}}, déclarée {{public static void::trois mots}}.",
    answer: "",
  },
];

export function sampleDb(now = Date.now()): Db {
  const db = emptyDb();
  const deck = makeDeck("Exemple : Java et Git", now, {
    description: "Paquet d'exemple (questions reprises de quiz-revision). Vous pouvez le modifier ou le supprimer.",
    answerMode: "typed",
  });
  db.decks.push(deck);
  SAMPLE_CARDS.forEach((d, i) => db.cards.push(makeCard(deck.id, d, now + i)));
  return db;
}
