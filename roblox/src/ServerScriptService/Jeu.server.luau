-- Rayan's Arène (Roblox) : le serveur décide de tout (règles, frais, sélection, examen).
-- Argent fictif uniquement. Aucun achat, aucune donnée gardée sur les joueurs.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Dossier = ReplicatedStorage:WaitForChild("Arene")
local R = require(Dossier:WaitForChild("Regles"))
local C = require(Dossier:WaitForChild("Config"))
local Prix = require(Dossier:WaitForChild("Prix"))
local Decor = require(script.Parent:WaitForChild("Decor"))

local prix, dates = Prix.clotures, Prix.dates
local per = R.periodes(#prix, C.ANNEES_ENTRAINEMENT, C.SEMAINES_EXAMEN)
assert(per, "Pas assez de semaines de prix dans le module Prix (relance construire.py).")

-- ------------------------------------------------------------ communication
local evenement = Instance.new("RemoteEvent")
evenement.Name = "Evenement"
evenement.Parent = Dossier
local statut = Instance.new("StringValue")
statut.Name = "Statut"
statut.Parent = Dossier

local function message(texte: string, joueur: Player?, duree: number?)
	if joueur then
		evenement:FireClient(joueur, "message", texte, duree or 8)
	else
		evenement:FireAllClients("message", texte, duree or 8)
	end
end

-- ------------------------------------------------------------ décor
local ecranPart = Decor.construire()
local ecran = Decor.ecran(ecranPart)
local h = R.hasard(C.GRAINE or os.time())

local joueurs = {} -- [Player] = { robot = robot ou nil, choix = famille en attente ou nil }
local robots = {} -- population en course (robot doré à part)
local dore = nil
local prochainId = 1

local function couleurDe(genome)
	if genome == nil then
		return Color3.fromHex(R.OR)
	end
	return Color3.fromHex(R.COULEURS[genome.type])
end

local function couloirsLibres(): { number }
	local pris = {}
	for _, r in robots do
		pris[r.vue.couloir] = true
	end
	local libres = {}
	for c = 2, Decor.NB_COULOIRS do -- le couloir 1 est celui du robot doré
		if not pris[c] then
			table.insert(libres, c)
		end
	end
	return libres
end

local function creer(genome, proprietaire: Player?, parent: number?)
	local libres = couloirsLibres()
	local couloir = libres[1] or Decor.NB_COULOIRS
	local id = prochainId
	prochainId += 1
	local nom = if proprietaire then proprietaire.DisplayName else R.NOMS[genome.type] .. " n°" .. id
	local r = {
		id = id,
		parent = parent,
		genome = genome,
		gain = 0,
		proprietaire = proprietaire,
		vue = Decor.robot(nom, couleurDe(genome), couloir),
	}
	table.insert(robots, r)
	if proprietaire and joueurs[proprietaire] then
		joueurs[proprietaire].robot = r
	end
	return r
end

local function creerDore()
	dore = { id = 0, gain = 0, vue = Decor.robot("Acheter et garder", couleurDe(nil), 1) }
end

-- les robots glissent doucement vers leur place
RunService.Heartbeat:Connect(function(dt)
	local liste = table.clone(robots)
	if dore then
		table.insert(liste, dore)
	end
	for _, r in liste do
		if r.vue.modele.Parent then
			local x = Decor.xCouloir(r.vue.couloir)
			local actuel = r.vue.cf.Position
			local z = actuel.Z + (r.vue.cible - actuel.Z) * math.min(1, dt * 8)
			local saut = math.abs(math.sin(os.clock() * 6 + r.vue.couloir)) * 0.4
			r.vue.placer(CFrame.new(x, Decor.HAUTEUR + saut, z))
		end
	end
end)

-- ------------------------------------------------------------ joueurs
local function leaderstat(joueur: Player, texte: string)
	local ls = joueur:FindFirstChild("leaderstats")
	local v = ls and ls:FindFirstChild("Gain %")
	if v then
		(v :: StringValue).Value = texte
	end
end

Players.PlayerAdded:Connect(function(joueur)
	joueurs[joueur] = {}
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	local v = Instance.new("StringValue")
	v.Name = "Gain %"
	v.Value = "—"
	v.Parent = ls
	ls.Parent = joueur
	task.delay(2, function()
		if joueurs[joueur] and not joueurs[joueur].robot then
			evenement:FireClient(joueur, "choisir")
		end
	end)
end)

Players.PlayerRemoving:Connect(function(joueur)
	local j = joueurs[joueur]
	if j and j.robot then
		j.robot.proprietaire = nil -- le robot reste dans la course, sans propriétaire
		j.robot.vue.nom(R.NOMS[j.robot.genome.type] .. " n°" .. j.robot.id)
	end
	joueurs[joueur] = nil
end)

local dernierClic = {}
evenement.OnServerEvent:Connect(function(joueur, action, famille)
	if action ~= "choisir" or type(famille) ~= "string" or R.NOMS[famille] == nil then
		return
	end
	local maintenant = os.clock()
	if dernierClic[joueur] and maintenant - dernierClic[joueur] < 1 then
		return
	end
	dernierClic[joueur] = maintenant
	local j = joueurs[joueur]
	if not j or j.robot then
		return
	end
	j.choix = famille
	evenement:FireClient(joueur, "choisi")
	message("C'est noté : ton robot " .. R.NOMS[famille] .. " entre au départ de la prochaine génération.", joueur, 5)
end)

-- robots des joueurs qui attendent leur tour ; renvoie le nombre de robots ajoutés
local function ajouterJoueurs(place: number): number
	local n = 0
	for joueur, j in joueurs do
		if j.choix and not j.robot and n < place then
			local g = R.genomeHasard(h, j.choix)
			j.choix = nil
			creer(g, joueur)
			n += 1
			message("Ta règle : " .. R.decrire(g) .. ".", joueur, 10)
		end
	end
	return n
end

-- ------------------------------------------------------------ une course
local function course(liste, debut: number, fin: number, duree: number, titre: string)
	local nbSem = fin - debut
	local maxi = 0.2
	for _, r in liste do
		local net = if r.genome then R.evaluer(r.genome, prix, debut, fin) else R.acheterGarder(prix, debut, fin)
		r.courbe = R.courbe(net)
		r.gain = R.total(net)
		for _, v in r.courbe do
			maxi = math.max(maxi, v - 1)
		end
		r.vue.cible = Decor.Z_DEPART
		r.vue.gain("+0,0 %", true)
		r.vue.couronner(false)
	end
	local echelle = (Decor.Z_MAX - Decor.Z_DEPART - 10) / maxi
	ecran.commencer(prix, debut, fin, titre, Prix.actif .. " : " .. dates[debut] .. " → " .. dates[fin])
	task.wait(1.5)
	for w = 1, nbSem do
		for _, r in liste do
			local v = r.courbe[w] - 1
			r.vue.cible = math.clamp(Decor.Z_DEPART + v * echelle, Decor.Z_MIN, Decor.Z_MAX)
			r.vue.gain(R.pct(v), v >= 0)
		end
		ecran.point(w)
		statut.Value = titre .. " — semaine " .. w .. "/" .. nbSem .. " (" .. dates[debut + w] .. ")"
		task.wait(duree / nbSem)
	end
end

local function nomDe(r)
	if r.proprietaire then
		return r.proprietaire.DisplayName
	end
	return if r.genome then R.NOMS[r.genome.type] .. " n°" .. r.id else "Acheter et garder"
end

-- ------------------------------------------------------------ une partie
local function partie()
	for _, r in robots do
		r.vue.retirer()
	end
	robots = {}
	for _, j in joueurs do
		j.robot = nil
	end
	if dore then
		dore.vue.retirer()
	end
	creerDore()
	evenement:FireAllClients("choisir")
	for s = C.ATTENTE_DEPART, 1, -1 do
		statut.Value = "Nouvelle partie dans " .. s .. " s : choisis la règle de ton robot !"
		task.wait(1)
	end

	local e = per.entrainement
	local n = ajouterJoueurs(C.NB_ROBOTS)
	for _ = n + 1, C.NB_ROBOTS do
		creer(R.genomeHasard(h))
	end

	local vivants = {}
	for gen = 1, C.GENERATIONS do
		local liste = table.clone(robots)
		table.insert(liste, dore)
		course(liste, e.debut, e.fin, C.DUREE_MANCHE, "Génération " .. gen .. "/" .. C.GENERATIONS .. " (entraînement)")

		local morts
		vivants, morts = R.selection(robots)
		vivants[1].vue.couronner(true)
		message(
			"Génération " .. gen .. " : la meilleure est " .. nomDe(vivants[1]) .. " (" .. R.pct(vivants[1].gain)
				.. "). Acheter et garder : " .. R.pct(dore.gain) .. ". La moitié la moins bonne explose !",
			nil,
			C.PAUSE + 2
		)
		for rang, r in vivants do
			if r.proprietaire then
				leaderstat(r.proprietaire, R.pct(r.gain))
				local texte = "Ton robot survit : " .. (if rang == 1 then "1er" else rang .. "e") .. " sur " .. #robots
					.. " (" .. R.pct(r.gain) .. ")."
				task.delay(3, message, texte, r.proprietaire, 5) -- après le message de toute l'arène
			end
		end
		task.wait(1)
		for _, r in morts do
			r.vue.exploser()
			if r.proprietaire and joueurs[r.proprietaire] then
				leaderstat(r.proprietaire, R.pct(r.gain) .. " (perdu)")
				joueurs[r.proprietaire].robot = nil
				local joueur = r.proprietaire
				task.delay(3, function()
					message("Ton robot a explosé (" .. R.pct(r.gain) .. "). Choisis une nouvelle règle !", joueur, 6)
					evenement:FireClient(joueur, "choisir")
				end)
			end
			task.wait(0.08)
		end
		robots = vivants
		if gen < C.GENERATIONS then
			statut.Value = "Les survivants font des enfants mutés…"
			task.wait(C.PAUSE)
			local place = C.NB_ROBOTS - #robots
			local ajoutes = ajouterJoueurs(place)
			for _, enfant in R.enfants(vivants, place - ajoutes, h, prochainId) do
				creer(enfant.genome, nil, enfant.parent)
			end
		end
	end

	-- L'examen : la championne et les robots des joueurs encore en vie, contre le robot doré
	local champion = vivants[1]
	local candidats = { champion, dore }
	for _, r in robots do
		if r ~= champion then
			if r.proprietaire then
				table.insert(candidats, r)
			else
				r.vue.retirer()
			end
		end
	end
	robots = {}
	for _, r in candidats do
		if r ~= dore then
			table.insert(robots, r)
		end
	end
	message(
		"L'examen ! La championne " .. nomDe(champion) .. " joue l'année suivante, qu'elle n'a jamais vue, sans rien changer à sa règle : "
			.. R.decrire(champion.genome) .. ".",
		nil,
		C.DUREE_EXAMEN
	)
	task.wait(3)
	local x = per.examen
	course(candidats, x.debut, x.fin, C.DUREE_EXAMEN, "L'EXAMEN : l'année jamais vue")
	champion.vue.couronner(champion.gain > dore.gain)
	dore.vue.couronner(dore.gain >= champion.gain)

	local bilan = "Examen (" .. dates[x.debut] .. " → " .. dates[x.fin] .. ") : " .. nomDe(champion) .. " fait "
		.. R.pct(champion.gain) .. ", Acheter et garder fait " .. R.pct(dore.gain) .. ". "
	if dore.gain >= champion.gain then
		bilan ..= "Acheter et garder gagne. La championne était la meilleure sur le passé, mais le marché ne rejoue jamais "
			.. "la même partie : c'est la leçon de l'Arène."
	else
		bilan ..= "La championne gagne cette fois. Une seule année ne prouve rien : rejoue, souvent c'est l'inverse."
	end
	bilan ..= " (Argent fictif, ce n'est pas un conseil.)"
	message(bilan, nil, 20)
	for _, r in robots do
		if r.proprietaire then
			leaderstat(r.proprietaire, R.pct(r.gain) .. " (examen)")
		end
	end
	for s = 20, 1, -1 do
		statut.Value = "Fin de la partie. Nouvelle partie dans " .. s .. " s."
		task.wait(1)
	end
end

if Prix.demo then
	print("Rayan's Arène : prix de démonstration (lance construire.py avec le réseau pour de vrais prix).")
end
while true do
	partie()
end
