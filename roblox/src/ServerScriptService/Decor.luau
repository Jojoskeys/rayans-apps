-- Décor créé par script au démarrage : piste à couloirs, grand écran, robots, couronne, explosions.
local Lighting = game:GetService("Lighting")
local Debris = game:GetService("Debris")

local Decor = {}

Decor.LARGEUR_COULOIR = 5
Decor.NB_COULOIRS = 32
Decor.Z_DEPART = 70 -- ligne « 0 % »
Decor.Z_MAX = 250
Decor.Z_MIN = 4
Decor.HAUTEUR = 3.6 -- hauteur du centre des robots

local dossier: Folder

local function piece(props): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for k, v in props do
		(p :: any)[k] = v
	end
	return p
end

local function texte(parent, props): TextLabel
	local t = Instance.new("TextLabel")
	t.BackgroundTransparency = 1
	t.Font = Enum.Font.GothamBold
	t.TextColor3 = Color3.new(1, 1, 1)
	t.TextScaled = true
	for k, v in props do
		(t :: any)[k] = v
	end
	t.Parent = parent
	return t
end

function Decor.xCouloir(couloir: number): number
	return (couloir - (Decor.NB_COULOIRS + 1) / 2) * Decor.LARGEUR_COULOIR
end

function Decor.construire()
	Lighting.ClockTime = 14
	dossier = Instance.new("Folder")
	dossier.Name = "Arene"
	dossier.Parent = workspace

	local largeur = Decor.NB_COULOIRS * Decor.LARGEUR_COULOIR
	local longueur = Decor.Z_MAX + 20
	piece({
		Name = "Piste",
		Size = Vector3.new(largeur + 4, 1, longueur),
		CFrame = CFrame.new(0, 0.5, longueur / 2),
		Color = Color3.fromRGB(45, 48, 60),
		Parent = dossier,
	})
	for i = 0, Decor.NB_COULOIRS do
		piece({
			Name = "Ligne",
			Size = Vector3.new(0.2, 0.05, longueur),
			CFrame = CFrame.new(Decor.xCouloir(i) + Decor.LARGEUR_COULOIR / 2, 1.03, longueur / 2),
			Color = Color3.fromRGB(200, 200, 210),
			CanCollide = false,
			Parent = dossier,
		})
	end
	local depart = piece({
		Name = "Depart",
		Size = Vector3.new(largeur + 4, 0.06, 1),
		CFrame = CFrame.new(0, 1.04, Decor.Z_DEPART),
		Color = Color3.fromRGB(80, 220, 120),
		Material = Enum.Material.Neon,
		CanCollide = false,
		Parent = dossier,
	})
	-- panneau « 0 % » au bord de la piste
	local panneau = piece({
		Name = "Panneau0",
		Size = Vector3.new(1, 6, 10),
		CFrame = CFrame.new(-largeur / 2 - 4, 3, Decor.Z_DEPART),
		Color = Color3.fromRGB(30, 30, 40),
		Parent = dossier,
	})
	for _, face in { Enum.NormalId.Left, Enum.NormalId.Right } do
		local sg = Instance.new("SurfaceGui")
		sg.Face = face
		sg.Parent = panneau
		texte(sg, { Size = UDim2.fromScale(1, 1), Text = "0 %\nplus loin = plus de gain" })
	end
	local _ = depart

	-- grand écran au bout de la piste
	local ecran = piece({
		Name = "Ecran",
		Size = Vector3.new(150, 70, 2),
		CFrame = CFrame.new(0, 45, Decor.Z_MAX + 30),
		Color = Color3.fromRGB(10, 10, 16),
		Parent = dossier,
	})
	for _, x in { -70, 70 } do
		piece({
			Name = "Pilier",
			Size = Vector3.new(4, 12, 4),
			CFrame = CFrame.new(x, 6, Decor.Z_MAX + 30),
			Color = Color3.fromRGB(60, 60, 70),
			Parent = dossier,
		})
	end
	return ecran
end

-- ------------------------------------------------------------ écran (SurfaceGui)
local W, H = 1400, 520

function Decor.ecran(partie: Part)
	local sg = Instance.new("SurfaceGui")
	sg.Face = Enum.NormalId.Front -- la face -Z, tournée vers la piste
	sg.SizingMode = Enum.SurfaceGuiSizingMode.FixedSize
	sg.CanvasSize = Vector2.new(1500, 700)
	sg.LightInfluence = 0
	sg.Parent = partie

	local titre = texte(sg, { Size = UDim2.new(1, -40, 0, 70), Position = UDim2.fromOffset(20, 10), Text = "Rayan's Arène" })
	local sous = texte(sg, {
		Size = UDim2.new(1, -40, 0, 44),
		Position = UDim2.fromOffset(20, 84),
		Text = "",
		Font = Enum.Font.Gotham,
		TextColor3 = Color3.fromRGB(190, 190, 205),
	})
	local zone = Instance.new("Frame")
	zone.Size = UDim2.fromOffset(W, H)
	zone.Position = UDim2.fromOffset(50, 150)
	zone.BackgroundColor3 = Color3.fromRGB(22, 24, 34)
	zone.BorderSizePixel = 0
	zone.ClipsDescendants = true
	zone.Parent = sg

	local e = { segments = {} :: { Frame }, points = {} :: { Vector2 } }

	local function trait(a: Vector2, b: Vector2, couleur: Color3, epaisseur: number)
		local d = b - a
		local f = Instance.new("Frame")
		f.AnchorPoint = Vector2.new(0.5, 0.5)
		f.Position = UDim2.fromOffset((a.X + b.X) / 2, (a.Y + b.Y) / 2)
		f.Size = UDim2.fromOffset(d.Magnitude + epaisseur / 2, epaisseur)
		f.Rotation = math.deg(math.atan2(d.Y, d.X))
		f.BackgroundColor3 = couleur
		f.BorderSizePixel = 0
		f.Parent = zone
		table.insert(e.segments, f)
	end

	-- prépare la courbe des prix de la semaine debut à fin (rien n'est montré avant d'y arriver)
	function e.commencer(prix: { number }, debut: number, fin: number, t: string, st: string)
		for _, f in e.segments do
			f:Destroy()
		end
		e.segments, e.points = {}, {}
		local mini, maxi = math.huge, -math.huge
		for i = debut, fin do
			mini, maxi = math.min(mini, prix[i]), math.max(maxi, prix[i])
		end
		local marge = (maxi - mini) * 0.08 + 1e-9
		mini, maxi = mini - marge, maxi + marge
		for i = debut, fin do
			local x = (i - debut) / (fin - debut) * W
			local y = H - (prix[i] - mini) / (maxi - mini) * H
			table.insert(e.points, Vector2.new(x, y))
		end
		-- ligne grise : le prix de départ (au-dessus = acheter et garder gagne)
		local y0 = e.points[1].Y
		trait(Vector2.new(0, y0), Vector2.new(W, y0), Color3.fromRGB(90, 90, 105), 2)
		titre.Text = t
		sous.Text = st
	end

	-- trace la semaine w (1 = première semaine après le départ)
	function e.point(w: number, couleur: Color3?)
		local a, b = e.points[w], e.points[w + 1]
		if a and b then
			trait(a, b, couleur or Color3.fromRGB(242, 201, 76), 5)
		end
	end

	function e.texte(st: string)
		sous.Text = st
	end

	return e
end

-- ------------------------------------------------------------ robots
local function boule(diametre: number, couleur: Color3, parent: Instance): Part
	local b = piece({
		Shape = Enum.PartType.Ball,
		Size = Vector3.new(diametre, diametre, diametre),
		Color = couleur,
		Material = Enum.Material.SmoothPlastic,
		CanCollide = false,
		CanQuery = false,
		CastShadow = false,
		Parent = parent,
	})
	return b
end

-- Un robot : corps rond coloré, deux yeux, antenne, couronne cachée, étiquette nom + gain.
function Decor.robot(nom: string, couleur: Color3, couloir: number)
	local m = Instance.new("Model")
	m.Name = nom
	local corps = boule(3.4, couleur, m)
	corps.Name = "Corps"
	m.PrimaryPart = corps
	local base = CFrame.new(0, 0, 0)
	local morceaux = { { corps, base } }
	for _, cote in { -0.7, 0.7 } do
		local oeil = boule(1, Color3.new(1, 1, 1), m)
		local pupille = boule(0.5, Color3.fromRGB(20, 20, 30), m)
		table.insert(morceaux, { oeil, CFrame.new(cote, 0.45, 1.3) })
		table.insert(morceaux, { pupille, CFrame.new(cote, 0.45, 1.75) })
	end
	local tige = piece({
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(1.3, 0.2, 0.2),
		Color = Color3.fromRGB(60, 60, 70),
		CanCollide = false,
		CanQuery = false,
		Parent = m,
	})
	table.insert(morceaux, { tige, CFrame.new(0, 2.2, 0) * CFrame.Angles(0, 0, math.rad(90)) })
	local bout = boule(0.6, couleur:Lerp(Color3.new(1, 1, 1), 0.4), m)
	bout.Material = Enum.Material.Neon
	table.insert(morceaux, { bout, CFrame.new(0, 2.95, 0) })

	-- couronne (cachée tant que le robot n'est pas le meilleur)
	local couronne = {}
	local anneau = piece({
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(0.6, 2.2, 2.2),
		Color = Color3.fromRGB(242, 201, 76),
		Material = Enum.Material.Neon,
		CanCollide = false,
		CanQuery = false,
		Transparency = 1,
		Parent = m,
	})
	table.insert(morceaux, { anneau, CFrame.new(0, 1.9, 0) * CFrame.Angles(0, 0, math.rad(90)) })
	table.insert(couronne, anneau)
	for i = 0, 3 do
		local a = i * math.pi / 2
		local pointe = boule(0.45, Color3.fromRGB(242, 201, 76), m)
		pointe.Transparency = 1
		table.insert(morceaux, { pointe, CFrame.new(math.cos(a) * 0.9, 2.35, math.sin(a) * 0.9) })
		table.insert(couronne, pointe)
	end

	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(160, 50)
	bb.StudsOffset = Vector3.new(0, 4.6, 0)
	bb.MaxDistance = 150
	bb.Adornee = corps
	bb.Parent = corps
	local lNom = texte(bb, { Size = UDim2.new(1, 0, 0.5, 0), Text = nom, TextStrokeTransparency = 0.4 })
	local lGain = texte(bb, {
		Size = UDim2.new(1, 0, 0.5, 0),
		Position = UDim2.fromScale(0, 0.5),
		Text = "+0,0 %",
		TextStrokeTransparency = 0.4,
	})

	local r = {
		modele = m,
		morceaux = morceaux,
		couloir = couloir,
		cf = CFrame.new(Decor.xCouloir(couloir), Decor.HAUTEUR, Decor.Z_DEPART),
		cible = Decor.Z_DEPART,
	}
	function r.placer(cf: CFrame)
		r.cf = cf
		for _, mc in morceaux do
			mc[1].CFrame = cf * mc[2]
		end
	end
	function r.gain(txt: string, positif: boolean)
		lGain.Text = txt
		lGain.TextColor3 = if positif then Color3.fromRGB(120, 235, 140) else Color3.fromRGB(255, 120, 120)
	end
	function r.nom(txt: string)
		lNom.Text = txt
	end
	function r.couronner(oui: boolean)
		for _, c in couronne do
			c.Transparency = if oui then 0 else 1
		end
	end
	function r.exploser()
		local ex = Instance.new("Explosion")
		ex.Position = r.cf.Position
		ex.BlastRadius = 4
		ex.BlastPressure = 0 -- aucun effet physique
		ex.DestroyJointRadiusPercent = 0 -- aucun dégât aux joueurs
		ex.ExplosionType = Enum.ExplosionType.NoCraters
		ex.Parent = workspace
		Debris:AddItem(ex, 2)
		m:Destroy()
	end
	function r.retirer()
		m:Destroy()
	end
	r.placer(r.cf)
	m.Parent = dossier
	return r
end

return Decor
