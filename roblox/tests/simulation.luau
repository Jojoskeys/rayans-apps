-- Simulation hors Studio : un faux Roblox minimal (Instance, CFrame, Color3, task…) pour faire
-- tourner une partie complète du serveur et l'interface du client, sans Roblox Studio.
-- Ne vérifie PAS le rendu ni l'API réelle de Roblox ; attrape les erreurs de logique (nil, ordre…).
-- Lancé par tests/test_construire.py, qui remplace la ligne SOURCES par le code des scripts.
local SOURCES = {} --[[SOURCES]]

-- ------------------------------------------------------------ valeurs
local function proxy(nom)
	return setmetatable({}, {
		__index = function(_, k)
			return proxy(nom .. "." .. tostring(k))
		end,
		__tostring = function()
			return nom
		end,
	})
end
local Enum = proxy("Enum")

local V3 = {}
V3.__index = V3
local function v3(x, y, z)
	return setmetatable({ X = x or 0, Y = y or 0, Z = z or 0 }, V3)
end
V3.__sub = function(a, b)
	return v3(a.X - b.X, a.Y - b.Y, a.Z - b.Z)
end
local V2 = {}
V2.__index = function(t, k)
	if k == "Magnitude" then
		return math.sqrt(t.X ^ 2 + t.Y ^ 2)
	end
	return nil
end
local function v2(x, y)
	assert(type(x) == "number" and type(y) == "number", "Vector2.new attend deux nombres")
	return setmetatable({ X = x, Y = y }, V2)
end
V2.__sub = function(a, b)
	return v2(a.X - b.X, a.Y - b.Y)
end

local CF = {}
CF.__index = CF
local function cf(x, y, z)
	assert(type(x) == "number" and x == x, "CFrame.new : x invalide")
	return setmetatable({ Position = v3(x, y, z) }, CF)
end
CF.__mul = function(a, b)
	return cf(a.Position.X + b.Position.X, a.Position.Y + b.Position.Y, a.Position.Z + b.Position.Z)
end

local C3 = {}
C3.__index = C3
local function c3(r, g, b)
	return setmetatable({ R = r, G = g, B = b }, C3)
end
function C3.Lerp(a, b, t)
	return c3(a.R + (b.R - a.R) * t, a.G + (b.G - a.G) * t, a.B + (b.B - a.B) * t)
end

-- ------------------------------------------------------------ signaux et instances
local function signal()
	local s = { liste = {} }
	function s:Connect(f)
		table.insert(self.liste, f)
		return { Disconnect = function() end }
	end
	function s:Fire(...)
		for _, f in self.liste do
			f(...)
		end
	end
	return s
end

local journal = { clients = {}, explosions = 0, statuts = {} }
local Inst = {}
local function nouvelle(classe, nom)
	local o = { ClassName = classe, Name = nom or classe, _enfants = {}, _signaux = {} }
	return setmetatable(o, Inst)
end
Inst.__index = function(o, k)
	local m = rawget(Inst, k)
	if m then
		return m
	end
	if k == "Parent" then
		return rawget(o, "_parent")
	end
	if k == "OnServerEvent" or k == "OnClientEvent" or k == "Activated" or k == "Heartbeat"
		or k == "PlayerAdded" or k == "PlayerRemoving" then
		o._signaux[k] = o._signaux[k] or signal()
		return o._signaux[k]
	end
	return nil
end
Inst.__newindex = function(o, k, v)
	if k == "Parent" then
		local avant = rawget(o, "_parent")
		if avant then
			avant._enfants[o] = nil
		end
		rawset(o, "_parent", v)
		if v then
			v._enfants[o] = true
		end
		if o.ClassName == "Explosion" and v then
			journal.explosions += 1
		end
		return
	end
	if k == "Value" and o.ClassName == "StringValue" then
		rawset(o, "_valeur", v)
		table.insert(journal.statuts, v)
		if o._change then
			o._change:Fire()
		end
		return
	end
	rawset(o, k, v)
end
function Inst.FindFirstChild(o, nom)
	for e in o._enfants do
		if e.Name == nom then
			return e
		end
	end
	return nil
end
function Inst.WaitForChild(o, nom)
	return assert(o:FindFirstChild(nom), "WaitForChild bloquerait : " .. nom .. " dans " .. o.Name)
end
function Inst.Destroy(o)
	o.Parent = nil
end
function Inst.AddItem(_, _, _) end -- Debris
function Inst.GetPropertyChangedSignal(o, _)
	o._change = o._change or signal()
	return o._change
end
function Inst.FireClient(o, joueur, ...)
	table.insert(journal.clients, { joueur, ... })
	if o._client then
		o._client:Fire(...)
	end
end
function Inst.FireAllClients(o, ...)
	o:FireClient(nil, ...)
end
function Inst.FireServer(o, ...)
	o.OnServerEvent:Fire(journal.joueur, ...)
end

local Instance = {
	new = function(classe)
		local o = nouvelle(classe)
		if classe == "StringValue" then
			rawset(o, "_valeur", "")
		end
		return o
	end,
}

-- arbre du jeu
local game = nouvelle("DataModel", "game")
local services = {}
local function service(nom)
	if not services[nom] then
		services[nom] = nouvelle(nom)
		services[nom].Parent = game
	end
	return services[nom]
end
function game.GetService(_, nom)
	return service(nom)
end
local workspace = service("Workspace")
local RS = service("ReplicatedStorage")
local SSS = service("ServerScriptService")
local Players = service("Players")
local RunService = service("RunService")

local dossierArene = nouvelle("Folder", "Arene")
dossierArene.Parent = RS
local modules = {}
for _, nom in { "Regles", "Config", "Prix" } do
	local m = nouvelle("ModuleScript", nom)
	m.Parent = dossierArene
	modules[m] = nom
end
local decor = nouvelle("ModuleScript", "Decor")
decor.Parent = SSS
modules[decor] = "Decor"
local scriptJeu = nouvelle("Script", "Jeu")
scriptJeu.Parent = SSS

-- ------------------------------------------------------------ temps
local horloge, attentes = 0, 0
local auPremierWait = {}
local task = {}
function task.wait(s)
	attentes += 1
	horloge += s or 0.03
	for _, f in auPremierWait do
		f()
	end
	auPremierWait = {}
	RunService.Heartbeat:Fire(0.1)
	local st = journal.statuts[#journal.statuts]
	if st and string.find(st, "^Fin de la partie") then
		error("FIN_DE_PARTIE", 0)
	end
	assert(attentes < 200000, "la partie ne se termine pas")
	return s
end
function task.delay(_, f, ...)
	f(...)
end

local fauxOs = setmetatable({ clock = function()
	return horloge
end }, { __index = os })

-- ------------------------------------------------------------ chargement des scripts
local env
local cache = {}
local function fauxRequire(m)
	local nom = modules[m]
	assert(nom, "require d'un objet inconnu")
	if cache[nom] == nil then
		cache[nom] = executer(nom, m)
	end
	return cache[nom]
end

function executer(nom, objetScript)
	local f = assert(loadstring(SOURCES[nom], nom))
	local e = setmetatable({
		game = game,
		workspace = workspace,
		script = objetScript,
		require = fauxRequire,
		Instance = Instance,
		Enum = Enum,
		task = task,
		os = fauxOs,
		Vector3 = { new = v3 },
		Vector2 = { new = v2 },
		CFrame = {
			new = cf,
			Angles = function()
				return cf(0, 0, 0)
			end,
		},
		Color3 = {
			new = c3,
			fromRGB = function(r, g, b)
				return c3(r / 255, g / 255, b / 255)
			end,
			fromHex = function(h)
				assert(type(h) == "string" and #h == 7, "fromHex : couleur invalide " .. tostring(h))
				return c3(0, 0, 0)
			end,
		},
		UDim = { new = function(a, b)
			return { a, b }
		end },
		UDim2 = {
			new = function(...)
				return { ... }
			end,
			fromOffset = function(...)
				return { ... }
			end,
			fromScale = function(...)
				return { ... }
			end,
		},
	}, { __index = env })
	setfenv(f, e)
	return f()
end
env = getfenv(1)

-- StringValue : lire Value
local ancienIndex = Inst.__index
Inst.__index = function(o, k)
	if k == "Value" and rawget(o, "ClassName") == "StringValue" then
		return rawget(o, "_valeur")
	end
	return ancienIndex(o, k)
end

-- un joueur arrive au début et choisit « rebond »
local joueur = nouvelle("Player", "Joueur")
joueur.DisplayName = "Joueur test"
journal.joueur = joueur
table.insert(auPremierWait, function()
	Players.PlayerAdded:Fire(joueur)
	local ev = dossierArene:FindFirstChild("Evenement")
	ev.OnServerEvent:Fire(joueur, "choisir", "rebond")
	ev.OnServerEvent:Fire(joueur, "choisir", "n'importe quoi") -- refusé sans erreur
end)

local ok, err = pcall(executer, "Jeu", scriptJeu)
assert(not ok and err == "FIN_DE_PARTIE", "le serveur a planté : " .. tostring(err))

-- vérifications
local msgs, choisir, bilan = 0, 0, nil
for _, m in journal.clients do
	if m[2] == "message" then
		msgs += 1
		if string.find(m[3], "^Examen") then
			bilan = m[3]
		end
	elseif m[2] == "choisir" then
		choisir += 1
	end
end
assert(bilan, "pas de message final de l'examen")
assert(journal.explosions >= 15, "explosions : " .. journal.explosions)
local ls = joueur:FindFirstChild("leaderstats")
assert(ls and ls:FindFirstChild("Gain %"), "leaderstats manquant")
local gain = ls:FindFirstChild("Gain %").Value
assert(gain ~= "—", "le Gain % du joueur n'a pas été mis à jour")

-- l'interface du client se charge et réagit aux messages
local starter = nouvelle("PlayerGui", "PlayerGui")
starter.Parent = joueur
Players.LocalPlayer = joueur
local ev = dossierArene:FindFirstChild("Evenement")
ev._client = ev.OnClientEvent
executer("Interface", nouvelle("LocalScript", "Interface"))
ev:FireClient(joueur, "choisir")
ev:FireClient(joueur, "message", "Bonjour", 1)
ev:FireClient(joueur, "choisi")

print("BILAN " .. bilan)
print(string.format("simulation ok : %d messages, %d explosions, Gain %% = %s, %d attentes", msgs, journal.explosions, gain, attentes))
