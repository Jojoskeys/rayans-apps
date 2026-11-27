-- Récompenses quotidiennes : logique pure (testable sans Roblox). Aucun argent du jeu : des aspects et
-- des objets uniques. Le jour 2 (aide à revenir le lendemain) et le jour 7 sont les grosses récompenses.
local M = {}

M.SECONDES_PAR_JOUR = 86400

M.LISTE = {
	{ jour = 1, nom = "Étincelle bleue", genre = "aspect", grosse = false },
	{ jour = 2, nom = "Robot argenté", genre = "robot rare", grosse = true },
	{ jour = 3, nom = "Antenne à pompon", genre = "aspect", grosse = false },
	{ jour = 4, nom = "Traînée de feu", genre = "aspect", grosse = false },
	{ jour = 5, nom = "Lunettes de soleil", genre = "aspect", grosse = false },
	{ jour = 6, nom = "Boîte mystère", genre = "boîte", grosse = false },
	{ jour = 7, nom = "Robot arc-en-ciel", genre = "robot rare", grosse = true },
}

-- numéro du jour (UTC) pour une heure Unix en secondes
function M.numeroJour(secondes: number): number
	return math.floor(secondes / M.SECONDES_PAR_JOUR)
end

-- donnees = { dernier = numéro du dernier jour récupéré, serie = jour de la série (1 à 7), objets = {noms} } ou nil
-- renvoie { droit = peut récupérer aujourd'hui, jour = jour de la série concerné }
function M.etat(donnees, aujourdhui: number)
	if donnees == nil or donnees.dernier == nil then
		return { droit = true, jour = 1 }
	end
	if aujourdhui <= donnees.dernier then
		return { droit = false, jour = donnees.serie }
	end
	if aujourdhui == donnees.dernier + 1 then
		return { droit = true, jour = donnees.serie % #M.LISTE + 1 }
	end
	return { droit = true, jour = 1 } -- un jour manqué : la série repart du jour 1
end

-- renvoie (nouvelles données, récompense) ; ne modifie pas l'entrée ; (nil, nil) si rien à récupérer
function M.appliquer(donnees, aujourdhui: number)
	local e = M.etat(donnees, aujourdhui)
	if not e.droit then
		return nil, nil
	end
	local recompense = M.LISTE[e.jour]
	local objets = {}
	local possede = false
	local anciens = if donnees and donnees.objets then donnees.objets else {}
	for _, nom in anciens do
		table.insert(objets, nom)
		if nom == recompense.nom then
			possede = true
		end
	end
	if not possede then
		table.insert(objets, recompense.nom)
	end
	return { dernier = aujourdhui, serie = e.jour, objets = objets }, recompense
end

return M
