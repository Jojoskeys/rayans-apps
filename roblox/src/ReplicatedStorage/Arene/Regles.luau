-- Rayan's Arène (Roblox) : logique pure, sans rien de Roblox, testable avec le CLI `luau`.
-- Port simplifié de arene/arene.py (genome_hasard, muter, positions, evaluer) sur des prix
-- HEBDOMADAIRES : les durées sont en semaines au lieu de jours.
-- Argent fictif uniquement. Positions : 0 = cash, 1 = investi (jamais de vente à découvert).

local Regles = {}

Regles.FRAIS = 0.001 -- 0,1 % par ordre
Regles.GLISSEMENT = 0.0005 -- 0,05 % par ordre
Regles.COUT_ORDRE = Regles.FRAIS + Regles.GLISSEMENT
Regles.CHAUFFE = 52 -- semaines de passé utilisées pour calculer les indicateurs (jamais le futur)

Regles.TYPES = { "croisement", "rebond", "momentum", "tendance" }

Regles.NOMS = {
	croisement = "Croisement",
	rebond = "Rebond",
	momentum = "Momentum",
	tendance = "Tendance",
}

-- mêmes couleurs que la tuile animée de Rayan's Mobile (arene-film.tsx)
Regles.COULEURS = {
	croisement = "#5B8DEF",
	rebond = "#E3A33B",
	momentum = "#C77DDB",
	tendance = "#3BA776",
}
Regles.OR = "#F2C94C"

Regles.EXPLICATIONS = {
	croisement = "Investi quand la moyenne courte des prix passe au-dessus de la moyenne longue.",
	rebond = "Achète après une grosse baisse, revend après une hausse (ou coupe les pertes).",
	momentum = "Investi quand le prix a bien monté ces dernières semaines.",
	tendance = "Investi quand le prix est au-dessus de sa moyenne : il suit la tendance.",
}

export type Genome = { [string]: any }
export type Hasard = {
	reel: (Hasard) -> number,
	entier: (Hasard, number, number) -> number,
	uniforme: (Hasard, number, number) -> number,
	choix: <T>(Hasard, { T }) -> T,
}

-- ------------------------------------------------------------ hasard reproductible
-- Générateur de Park-Miller (exact en nombres flottants), le même dans Roblox et dans `luau`.
local Hasard = {}
Hasard.__index = Hasard

function Regles.hasard(graine: number?): Hasard
	local g = math.floor(graine or 1) % 2147483647
	if g <= 0 then
		g = g + 2147483646
	end
	return (setmetatable({ etat = g }, Hasard) :: any) :: Hasard
end

function Hasard.reel(self: any): number
	self.etat = (self.etat * 48271) % 2147483647
	return (self.etat - 1) / 2147483646
end

function Hasard.entier(self: any, a: number, b: number): number
	return math.min(b, a + math.floor(self:reel() * (b - a + 1)))
end

function Hasard.uniforme(self: any, a: number, b: number): number
	return a + (b - a) * self:reel()
end

function Hasard.choix(self: any, t: { any }): any
	return t[self:entier(1, #t)]
end

local function arrondi(x: number, decimales: number): number
	local m = 10 ^ decimales
	return math.floor(x * m + 0.5) / m
end

local function borne(v: number, a: number, b: number): number
	return math.max(a, math.min(b, v))
end

-- ------------------------------------------------------------ génomes
function Regles.genomeHasard(h: Hasard, type_: string?): Genome
	local t = type_ or h:choix(Regles.TYPES)
	local g: Genome = { type = t, filtre = h:choix({ 0, 0, 20, 30, 40 }) }
	if t == "croisement" then
		g.court = h:entier(1, 10)
		g.long = h:entier(g.court + 2, 50)
	elseif t == "rebond" then
		g.baisse = arrondi(h:uniforme(0.02, 0.20), 3)
		g.hausse = arrondi(h:uniforme(0.02, 0.30), 3)
		g.fenetre = h:entier(1, 12)
		g.stop = arrondi(h:uniforme(0.03, 0.25), 3)
	elseif t == "momentum" then
		g.semaines = h:entier(2, 50)
		g.seuil = arrondi(h:uniforme(-0.02, 0.10), 3)
	else
		g.semaines = h:entier(4, 50)
	end
	return g
end

local ENTIERS = { court = true, long = true, fenetre = true, semaines = true }

function Regles.copier(g: Genome): Genome
	local e: Genome = {}
	for k, v in g do
		e[k] = v
	end
	return e
end

-- Enfant : copie avec un ou deux paramètres légèrement modifiés (comme muter dans arene.py).
function Regles.muter(g: Genome, h: Hasard): Genome
	local e = Regles.copier(g)
	local cles = {}
	for k in e do
		if k ~= "type" then
			table.insert(cles, k)
		end
	end
	table.sort(cles) -- ordre fixe : même graine, même enfant
	local nb = math.min(#cles, h:choix({ 1, 2 }))
	for _ = 1, nb do
		local k = table.remove(cles, h:entier(1, #cles))
		if k == nil then
			break
		end
		local v = e[k]
		if k == "filtre" then
			e[k] = h:choix({ 0, 20, 30, 40 })
		elseif ENTIERS[k] then
			e[k] = math.floor(borne(math.floor(v * h:uniforme(0.75, 1.3) + 0.5) + h:choix({ -1, 0, 1 }), 1, 50))
		else
			e[k] = arrondi(borne(v * h:uniforme(0.7, 1.4), 0.005, 0.5), 3)
		end
	end
	if e.type == "croisement" and e.long <= e.court + 1 then
		e.long = math.min(50, e.court + 2)
		e.court = math.min(e.court, e.long - 2)
	end
	return e
end

-- ------------------------------------------------------------ règles
-- Moyenne des n derniers prix, semaine t comprise. nil avant d'avoir n prix.
local function moyennes(prix: { number }, n: number): { number? }
	local out: { number? } = {}
	local somme = 0
	for t = 1, #prix do
		somme += prix[t]
		if t > n then
			somme -= prix[t - n]
		end
		out[t] = if t >= n then somme / n else nil
	end
	return out
end
Regles.moyennes = moyennes

local function au_dessus(a: number?, b: number?): boolean
	return a ~= nil and b ~= nil and a > b
end

-- Position (0 ou 1) décidée à la clôture de chaque semaine, avec les prix <= cette semaine.
function Regles.positions(g: Genome, prix: { number }): { number }
	local n = #prix
	local ok: { boolean } = table.create(n, false)
	if g.type == "croisement" then
		local c, l = moyennes(prix, g.court), moyennes(prix, g.long)
		for t = 1, n do
			ok[t] = au_dessus(c[t], l[t])
		end
	elseif g.type == "momentum" then
		local j = g.semaines
		for t = j + 1, n do
			ok[t] = prix[t] / prix[t - j] - 1 > g.seuil
		end
	elseif g.type == "tendance" then
		local m = moyennes(prix, g.semaines)
		for t = 1, n do
			ok[t] = au_dessus(prix[t], m[t])
		end
	else -- rebond
		local f, investi, entree = g.fenetre, false, 0
		for t = 1, n do
			if investi then
				if prix[t] >= entree * (1 + g.hausse) or prix[t] <= entree * (1 - g.stop) then
					investi = false
				end
			elseif t > f then
				local haut = prix[t]
				for s = t - f, t do
					haut = math.max(haut, prix[s])
				end
				if prix[t] <= haut * (1 - g.baisse) then
					investi, entree = true, prix[t]
				end
			end
			ok[t] = investi
		end
	end
	local filtre = if g.filtre and g.filtre > 0 then moyennes(prix, g.filtre) else nil
	local pos = table.create(n, 0)
	for t = 1, n do
		local investi = ok[t]
		if filtre and not au_dessus(prix[t], filtre[t]) then
			investi = false
		end
		pos[t] = if investi then 1 else 0
	end
	return pos
end

-- Rendement de chaque semaine, frais et glissement compris. La position décidée à la clôture de t
-- s'applique au mouvement t -> t+1 ; chaque changement de position paie un ordre ; départ en cash.
function Regles.rendements(pos: { number }, prix: { number }): ({ number }, number)
	local net, ordres = {}, 0
	for t = 1, #prix - 1 do
		local avant = if t > 1 then pos[t - 1] else 0
		local ordre = math.abs(pos[t] - avant)
		ordres += ordre
		local r = prix[t + 1] / prix[t] - 1
		net[t] = (1 - ordre * Regles.COUT_ORDRE) * (1 + pos[t] * r) - 1
	end
	return net, ordres
end

-- Stratégie jouée de la semaine debut à la semaine fin (indices de prix, fin - debut rendements).
-- Les indicateurs lisent au plus CHAUFFE semaines AVANT debut, et rien après fin.
function Regles.evaluer(g: Genome, prix: { number }, debut: number, fin: number): ({ number }, number)
	local a = math.max(1, debut - Regles.CHAUFFE)
	local morceau = table.move(prix, a, fin, 1, {})
	local pos = Regles.positions(g, morceau)
	local decale = debut - a
	return Regles.rendements(table.move(pos, decale + 1, #pos, 1, {}), table.move(morceau, decale + 1, #morceau, 1, {}))
end

function Regles.acheterGarder(prix: { number }, debut: number, fin: number): ({ number }, number)
	local p = table.move(prix, debut, fin, 1, {})
	return Regles.rendements(table.create(#p, 1), p)
end

-- Valeur de 1 € fictif après chaque semaine (courbe[0] n'existe pas : départ = 1).
function Regles.courbe(net: { number }): { number }
	local v, c = 1, {}
	for i, r in net do
		v *= 1 + r
		c[i] = v
	end
	return c
end

function Regles.total(net: { number }): number
	local v = 1
	for _, r in net do
		v *= 1 + r
	end
	return v - 1
end

-- ------------------------------------------------------------ sélection
-- Classe du meilleur gain au moins bon ; à égalité, le plus ancien (id le plus petit) d'abord.
function Regles.classer(robots: { any }): { any }
	local l = table.clone(robots)
	table.sort(l, function(a, b)
		if a.gain ~= b.gain then
			return a.gain > b.gain
		end
		return a.id < b.id
	end)
	return l
end

-- La moitié la moins bonne meurt. Renvoie survivants (classés) et morts.
function Regles.selection(robots: { any }): ({ any }, { any })
	local l = Regles.classer(robots)
	local garde = math.ceil(#l / 2)
	local vivants, morts = {}, {}
	for i, r in l do
		table.insert(if i <= garde then vivants else morts, r)
	end
	return vivants, morts
end

-- nb enfants mutés de survivants tirés au hasard. Les ids continuent à partir de prochainId.
function Regles.enfants(vivants: { any }, nb: number, h: Hasard, prochainId: number): { any }
	local l = {}
	if #vivants == 0 then
		return l
	end
	for i = 1, nb do
		local mere = h:choix(vivants)
		table.insert(l, { id = prochainId + i - 1, parent = mere.id, genome = Regles.muter(mere.genome, h) })
	end
	return l
end

-- Découpe nbPrix semaines : chauffe, puis entraînement, puis l'examen (les dernières semaines).
-- Renvoie nil s'il n'y a pas au moins un an d'entraînement.
function Regles.periodes(nbPrix: number, ansEntrainement: number, semExamen: number): any
	local examFin = nbPrix
	local examDebut = examFin - semExamen
	local dispo = examDebut - 1 - Regles.CHAUFFE
	local ans = math.min(ansEntrainement, math.floor(dispo / 52))
	if ans < 1 then
		return nil
	end
	return {
		entrainement = { debut = examDebut - 52 * ans, fin = examDebut },
		examen = { debut = examDebut, fin = examFin },
		ans = ans,
	}
end

-- ------------------------------------------------------------ textes
function Regles.pct(x: number): string
	local s = string.format("%+.1f %%", x * 100)
	return (string.gsub(s, "%.", ","))
end

local function p(x: number): string
	return (string.gsub(string.format("%.1f %%", x * 100), "%.", ","))
end

local function sem(n: number): string
	return if n > 1 then n .. " semaines" else "1 semaine"
end

function Regles.decrire(g: Genome): string
	local t, s = g.type, ""
	if t == "croisement" then
		s = "Investi quand la moyenne des " .. sem(g.court) .. " est au-dessus de celle des " .. sem(g.long)
	elseif t == "rebond" then
		s = "Achète après une baisse de " .. p(g.baisse) .. " sous le plus haut des " .. sem(g.fenetre)
			.. ", revend à +" .. p(g.hausse) .. " (ou coupe à -" .. p(g.stop) .. ")"
	elseif t == "momentum" then
		if g.seuil >= 0 then
			s = "Investi si le prix a monté de plus de " .. p(g.seuil) .. " sur les " .. sem(g.semaines)
		else
			s = "Investi si le prix n'a pas baissé de plus de " .. p(-g.seuil) .. " sur les " .. sem(g.semaines)
		end
	else
		s = "Investi quand le prix est au-dessus de sa moyenne des " .. sem(g.semaines)
	end
	if g.filtre and g.filtre > 0 then
		s ..= ", et seulement si le prix est au-dessus de sa moyenne " .. g.filtre .. " semaines"
	end
	return s
end

return Regles
