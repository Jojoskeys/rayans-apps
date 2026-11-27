-- Récompenses quotidiennes (côté serveur : le client ne peut pas tricher, il ne fait que demander).
-- Elles s'ouvrent quand le joueur a choisi son premier robot (fin du mini-tutoriel).
-- Données gardées : le dernier jour récupéré, la série et les objets obtenus (rien d'autre, pas de chat).
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Dossier = ReplicatedStorage:WaitForChild("Arene")
local R = require(Dossier:WaitForChild("Regles"))
local Rec = require(Dossier:WaitForChild("Recompenses"))
local evenementJeu = Dossier:WaitForChild("Evenement") :: RemoteEvent -- créé par Jeu

local evenement = Instance.new("RemoteEvent")
evenement.Name = "Recompense"
evenement.Parent = Dossier

local ok, magasin = pcall(function()
	return DataStoreService:GetDataStore("RecompensesQuotidiennes")
end)
if not ok then
	magasin = nil
end

local joueurs = {} -- [Player] = { donnees = table ou nil, pret, ouvert, enCours, tutoFini }

local function cle(joueur: Player): string
	return "joueur_" .. joueur.UserId
end

local function aujourdhui(): number
	return Rec.numeroJour(os.time())
end

local function proposer(joueur: Player)
	local j = joueurs[joueur]
	if not j or not j.pret or j.ouvert then
		return
	end
	j.ouvert = true
	local e = Rec.etat(j.donnees, aujourdhui())
	evenement:FireClient(joueur, "proposer", e.jour, e.droit, Rec.LISTE, if j.donnees then j.donnees.objets else {})
end

Players.PlayerAdded:Connect(function(joueur)
	joueurs[joueur] = { pret = false, ouvert = false, enCours = false, tutoFini = false }
	local donnees = nil
	if magasin then
		local lu, valeur = pcall(function()
			return magasin:GetAsync(cle(joueur))
		end)
		if not lu then
			warn("Récompenses : lecture impossible, pas de récompense cette fois.")
			joueurs[joueur] = nil
			return
		end
		donnees = valeur
	end
	local j = joueurs[joueur]
	if j then
		j.donnees = donnees
		j.pret = true
		if j.tutoFini then
			proposer(joueur)
		end
	end
end)

Players.PlayerRemoving:Connect(function(joueur)
	joueurs[joueur] = nil
end)

-- le mini-tutoriel est fini quand le joueur a choisi la famille de son robot (Jeu valide le choix de son côté)
evenementJeu.OnServerEvent:Connect(function(joueur, action, famille)
	if action ~= "choisir" or type(famille) ~= "string" or R.NOMS[famille] == nil then
		return
	end
	local j = joueurs[joueur]
	if j then
		j.tutoFini = true
		task.delay(6, proposer, joueur)
	end
end)

evenement.OnServerEvent:Connect(function(joueur, action)
	local j = joueurs[joueur]
	if action ~= "reclamer" or not j or not j.pret or j.enCours then
		return
	end
	j.enCours = true
	local jour = aujourdhui()
	local recompense = nil
	local nouvelles = nil
	if magasin then
		local fait, err = pcall(function()
			magasin:UpdateAsync(cle(joueur), function(ancien)
				-- vérifié avec la valeur enregistrée, jamais avec ce que dit le client
				local d, r = Rec.appliquer(ancien, jour)
				if d == nil then
					return nil -- déjà récupérée : on n'écrit rien
				end
				nouvelles, recompense = d, r
				return d
			end)
		end)
		if not fait then
			warn("Récompenses : enregistrement impossible : " .. tostring(err))
			nouvelles, recompense = nil, nil
		end
	else
		nouvelles, recompense = Rec.appliquer(j.donnees, jour)
	end
	if nouvelles and recompense and joueurs[joueur] then
		j.donnees = nouvelles
		evenement:FireClient(joueur, "recu", recompense, nouvelles.objets)
	else
		evenement:FireClient(joueur, "refus")
	end
	j.enCours = false
end)
