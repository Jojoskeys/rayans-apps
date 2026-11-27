-- Petit écran des récompenses quotidiennes : 7 cases, le jour 2 et le jour 7 sont mis en valeur (bord or animé).
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Dossier = ReplicatedStorage:WaitForChild("Arene")
local evenement = Dossier:WaitForChild("Recompense") :: RemoteEvent

local gui = Instance.new("ScreenGui")
gui.Name = "Recompenses"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local fond = Instance.new("Frame")
fond.Size = UDim2.new(0, 640, 0, 300)
fond.AnchorPoint = Vector2.new(0.5, 0.5)
fond.Position = UDim2.fromScale(0.5, 0.5)
fond.BackgroundColor3 = Color3.fromRGB(20, 22, 32)
fond.BackgroundTransparency = 0.05
fond.Visible = false
fond.Parent = gui
local coin = Instance.new("UICorner")
coin.CornerRadius = UDim.new(0, 16)
coin.Parent = fond
local contrainte = Instance.new("UISizeConstraint")
contrainte.MaxSize = Vector2.new(640, 300)
contrainte.Parent = fond
local ratio = Instance.new("UIAspectRatioConstraint")
ratio.AspectRatio = 640 / 300
ratio.Parent = fond

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

local titre = etiquette(fond, {
	Size = UDim2.new(1, -24, 0.14, 0),
	Position = UDim2.new(0, 12, 0.03, 0),
	Text = "Récompense du jour",
})
local sousTitre = etiquette(fond, {
	Size = UDim2.new(1, -24, 0.08, 0),
	Position = UDim2.new(0, 12, 0.17, 0),
	Font = Enum.Font.Gotham,
	TextColor3 = Color3.fromRGB(190, 190, 205),
	Text = "Reviens chaque jour : le jour 2 et le jour 7 sont les plus grosses.",
})

local cases = {}
for i = 1, 7 do
	local c = Instance.new("Frame")
	c.Size = UDim2.new(0.13, 0, 0.42, 0)
	c.Position = UDim2.new(0.015 + (i - 1) * 0.139, 0, 0.3, 0)
	c.BackgroundColor3 = Color3.fromRGB(45, 50, 70)
	c.Parent = fond
	local cc = Instance.new("UICorner")
	cc.CornerRadius = UDim.new(0, 10)
	cc.Parent = c
	local bord = Instance.new("UIStroke")
	bord.Thickness = 0
	bord.Color = Color3.fromRGB(242, 201, 76)
	bord.Parent = c
	etiquette(c, { Size = UDim2.new(1, -6, 0.22, 0), Position = UDim2.new(0, 3, 0.04, 0), Text = "Jour " .. i })
	local nom = etiquette(c, {
		Size = UDim2.new(1, -6, 0.6, 0),
		Position = UDim2.new(0, 3, 0.3, 0),
		Font = Enum.Font.Gotham,
		Text = "",
	})
	cases[i] = { cadre = c, bord = bord, nom = nom }
end

local bouton = Instance.new("TextButton")
bouton.Size = UDim2.new(0.5, 0, 0.17, 0)
bouton.AnchorPoint = Vector2.new(0.5, 0)
bouton.Position = UDim2.new(0.5, 0, 0.78, 0)
bouton.BackgroundColor3 = Color3.fromRGB(76, 175, 80)
bouton.Font = Enum.Font.GothamBold
bouton.TextColor3 = Color3.new(1, 1, 1)
bouton.TextScaled = true
bouton.Text = "Récupérer"
bouton.Parent = fond
local cb = Instance.new("UICorner")
cb.CornerRadius = UDim.new(0, 12)
cb.Parent = bouton

local etape = "proposer" -- "proposer" : le bouton demande la récompense ; "fermer" : il ferme l'écran
local anime = false

local function mettreEnValeur(jour: number, liste)
	for i, c in cases do
		local r = liste[i]
		c.nom.Text = r.nom
		c.bord.Thickness = if r.grosse then 3 else 0
		c.cadre.BackgroundColor3 = if r.grosse then Color3.fromRGB(95, 78, 20) else Color3.fromRGB(45, 50, 70)
		if i == jour then
			c.cadre.BackgroundColor3 = Color3.fromRGB(46, 110, 60)
		end
	end
	if not anime then
		anime = true
		for _, i in { 2, 7 } do -- les deux grosses récompenses : bord qui pulse
			TweenService
				:Create(
					cases[i].bord,
					TweenInfo.new(0.8, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true),
					{ Color = Color3.fromRGB(255, 120, 80) }
				)
				:Play()
		end
	end
end

bouton.Activated:Connect(function()
	if etape == "proposer" then
		bouton.Active = false
		evenement:FireServer("reclamer")
	else
		fond.Visible = false
	end
end)

evenement.OnClientEvent:Connect(function(action, a, b, c)
	if action == "proposer" then
		local jour, droit, liste = a, b, c
		mettreEnValeur(jour, liste)
		if droit then
			etape = "proposer"
			titre.Text = "Récompense du jour " .. jour
			bouton.Text = "Récupérer"
			bouton.Active = true
			fond.Visible = true
		end
	elseif action == "recu" then
		etape = "fermer"
		titre.Text = "Tu as obtenu : " .. a.nom .. " !"
		sousTitre.Text = "Reviens demain pour la suite de la série."
		bouton.Text = "OK"
		bouton.Active = true
	elseif action == "refus" then
		fond.Visible = false
	end
end)
