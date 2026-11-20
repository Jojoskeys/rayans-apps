-- Interface du joueur : bandeau d'état, choix de la famille de règle, messages.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Dossier = ReplicatedStorage:WaitForChild("Arene")
local R = require(Dossier:WaitForChild("Regles"))
local evenement = Dossier:WaitForChild("Evenement") :: RemoteEvent
local statut = Dossier:WaitForChild("Statut") :: StringValue

local gui = Instance.new("ScreenGui")
gui.Name = "Arene"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local function etiquette(parent, props): TextLabel
	local t = Instance.new("TextLabel")
	t.BackgroundTransparency = 1
	t.Font = Enum.Font.GothamBold
	t.TextColor3 = Color3.new(1, 1, 1)
	t.TextScaled = true
	t.TextWrapped = true
	for k, v in props do
		(t :: any)[k] = v
	end
	t.Parent = parent
	return t
end

local function arrondir(o: GuiObject, rayon: number)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, rayon)
	c.Parent = o
end

-- bandeau d'état en haut
local bandeau = etiquette(gui, {
	Size = UDim2.new(0.7, 0, 0, 40),
	Position = UDim2.new(0.15, 0, 0, 8),
	BackgroundTransparency = 0.35,
	BackgroundColor3 = Color3.fromRGB(20, 22, 32),
	Text = statut.Value,
})
arrondir(bandeau, 10)
statut:GetPropertyChangedSignal("Value"):Connect(function()
	bandeau.Text = statut.Value
end)

-- message (résultats, examen)
local boite = etiquette(gui, {
	Size = UDim2.new(0.6, 0, 0, 90),
	Position = UDim2.new(0.2, 0, 1, -110),
	BackgroundTransparency = 0.2,
	BackgroundColor3 = Color3.fromRGB(20, 22, 32),
	Font = Enum.Font.Gotham,
	Visible = false,
})
arrondir(boite, 12)
local pad = Instance.new("UIPadding")
pad.PaddingLeft, pad.PaddingRight = UDim.new(0, 12), UDim.new(0, 12)
pad.PaddingTop, pad.PaddingBottom = UDim.new(0, 8), UDim.new(0, 8)
pad.Parent = boite
local numeroMessage = 0

-- panneau de choix : 4 gros boutons
local panneau = Instance.new("Frame")
panneau.Size = UDim2.new(0, 560, 0, 400)
panneau.AnchorPoint = Vector2.new(0.5, 0.5)
panneau.Position = UDim2.fromScale(0.5, 0.5)
panneau.BackgroundColor3 = Color3.fromRGB(20, 22, 32)
panneau.BackgroundTransparency = 0.1
panneau.Visible = false
panneau.Parent = gui
arrondir(panneau, 16)
local taille = Instance.new("UISizeConstraint")
taille.MaxSize = Vector2.new(560, 400)
taille.Parent = panneau
local echelle = Instance.new("UIAspectRatioConstraint")
echelle.AspectRatio = 560 / 400
echelle.Parent = panneau

etiquette(panneau, {
	Size = UDim2.new(1, -24, 0.12, 0),
	Position = UDim2.new(0, 12, 0.02, 0),
	Text = "Choisis la règle de ton robot",
})
etiquette(panneau, {
	Size = UDim2.new(1, -24, 0.07, 0),
	Position = UDim2.new(0, 12, 0.14, 0),
	Font = Enum.Font.Gotham,
	TextColor3 = Color3.fromRGB(190, 190, 205),
	Text = "Les réglages sont tirés au hasard. Argent fictif, frais compris (0,15 % par ordre).",
})

for i, famille in R.TYPES do
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(1, -24, 0.17, 0)
	b.Position = UDim2.new(0, 12, 0.23 + (i - 1) * 0.19, 0)
	b.BackgroundColor3 = Color3.fromHex(R.COULEURS[famille])
	b.AutoButtonColor = true
	b.Text = ""
	b.Parent = panneau
	arrondir(b, 12)
	etiquette(b, { Size = UDim2.new(1, -16, 0.5, 0), Position = UDim2.new(0, 8, 0.05, 0), Text = R.NOMS[famille] })
	etiquette(b, {
		Size = UDim2.new(1, -16, 0.4, 0),
		Position = UDim2.new(0, 8, 0.55, 0),
		Font = Enum.Font.Gotham,
		Text = R.EXPLICATIONS[famille],
	})
	b.Activated:Connect(function()
		evenement:FireServer("choisir", famille)
	end)
end

evenement.OnClientEvent:Connect(function(action, texte, duree)
	if action == "choisir" then
		panneau.Visible = true
	elseif action == "choisi" then
		panneau.Visible = false
	elseif action == "message" then
		numeroMessage += 1
		local n = numeroMessage
		boite.Text = texte
		boite.Visible = true
		task.delay(duree or 8, function()
			if n == numeroMessage then
				boite.Visible = false
			end
		end)
	end
end)
