-- Réglages du jeu (modifiables sans toucher au reste).
return {
	NB_ROBOTS = 30, -- robots dans la population (robots des joueurs compris)
	GENERATIONS = 5, -- générations sur la période d'entraînement avant l'examen
	ANNEES_ENTRAINEMENT = 3, -- années de prix pour l'entraînement (réduites s'il n'y a pas assez de données)
	SEMAINES_EXAMEN = 52, -- l'année jamais vue
	DUREE_MANCHE = 12, -- secondes pour faire défiler les semaines d'une génération
	DUREE_EXAMEN = 10, -- secondes pour l'examen
	ATTENTE_DEPART = 15, -- secondes pour choisir sa famille avant la première génération
	PAUSE = 5, -- secondes entre deux générations
	GRAINE = nil :: number?, -- nil = partie différente à chaque fois ; un nombre = toujours la même
}
