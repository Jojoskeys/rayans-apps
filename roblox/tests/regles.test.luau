-- Tests de la logique pure :  luau tests/regles.test.luau   (depuis roblox/)
local R = require("../src/ReplicatedStorage/Arene/Regles")

local echecs, nb = 0, 0
local function test(nom, f)
	nb += 1
	local ok, err = pcall(f)
	if ok then
		print("ok   " .. nom)
	else
		echecs += 1
		print("ÉCHEC " .. nom .. " : " .. tostring(err))
	end
end
local function proche(a, b, tol)
	assert(math.abs(a - b) <= (tol or 1e-9), string.format("%.12g ~= %.12g", a, b))
end

test("hasard reproductible et dans les bornes", function()
	local a, b = R.hasard(7), R.hasard(7)
	for _ = 1, 1000 do
		local x = a:entier(3, 9)
		assert(x == b:entier(3, 9))
		assert(x >= 3 and x <= 9 and x == math.floor(x))
		local u = a:uniforme(0.5, 0.6)
		b:uniforme(0.5, 0.6)
		assert(u >= 0.5 and u <= 0.6)
	end
end)

test("génomes valides pour chaque famille", function()
	local h = R.hasard(3)
	for _ = 1, 300 do
		for _, t in R.TYPES do
			local g = R.genomeHasard(h, t)
			assert(g.type == t)
			if t == "croisement" then
				assert(g.court >= 1 and g.long >= g.court + 2 and g.long <= 50)
			end
			local e = R.muter(g, h)
			assert(e.type == t, "la mutation ne change pas la famille")
			if t == "croisement" then
				assert(e.long >= e.court + 2, "court " .. e.court .. " long " .. e.long)
			end
			assert(g ~= e)
			assert(type(R.decrire(e)) == "string")
		end
	end
end)

test("la mutation change un ou deux paramètres", function()
	local h = R.hasard(11)
	for _ = 1, 200 do
		local g = R.genomeHasard(h)
		local e = R.muter(g, h)
		local diff = 0
		for k, v in g do
			if e[k] ~= v then
				diff += 1
			end
		end
		assert(diff <= 2)
	end
end)

test("acheter et garder paie un seul ordre", function()
	local prix = { 100, 110, 121 }
	local net, ordres = R.acheterGarder(prix, 1, 3)
	assert(ordres == 1)
	proche(R.total(net), (1 - R.COUT_ORDRE) * 1.21 - 1)
end)

test("frais à chaque changement de position", function()
	local net, ordres = R.rendements({ 1, 0, 1, 0 }, { 100, 100, 100, 100, 100 })
	assert(ordres == 4, "ordres = " .. ordres)
	proche(R.total(net), (1 - R.COUT_ORDRE) ^ 4 - 1)
end)

test("pas de fuite du futur", function()
	local prix = {}
	for i = 1, 120 do
		prix[i] = 100 + 10 * math.sin(i / 5) + i * 0.2
	end
	local h = R.hasard(5)
	for _ = 1, 50 do
		local g = R.genomeHasard(h)
		local a = R.positions(g, prix)
		local coupe = table.move(prix, 1, 80, 1, {})
		local b = R.positions(g, coupe)
		for t = 1, 80 do
			assert(a[t] == b[t], "la position de la semaine " .. t .. " dépend du futur")
		end
	end
end)

test("tendance : investi au-dessus de la moyenne", function()
	local pos = R.positions({ type = "tendance", semaines = 2, filtre = 0 }, { 10, 11, 12, 11, 9 })
	local attendu = { 0, 1, 1, 0, 0 }
	for i, v in attendu do
		assert(pos[i] == v, "semaine " .. i)
	end
end)

test("rebond : achète après la baisse, revend à la hausse", function()
	local g = { type = "rebond", baisse = 0.1, hausse = 0.1, fenetre = 3, stop = 0.5, filtre = 0 }
	local pos = R.positions(g, { 100, 100, 100, 89, 95, 99, 100 })
	local attendu = { 0, 0, 0, 1, 1, 0, 0 }
	for i, v in attendu do
		assert(pos[i] == v, "semaine " .. i .. " : " .. pos[i])
	end
end)

test("evaluer ne joue que la période demandée", function()
	local prix = {}
	for i = 1, 200 do
		prix[i] = 100 * 1.002 ^ i
	end
	local net, _ = R.evaluer({ type = "tendance", semaines = 10, filtre = 0 }, prix, 100, 152)
	assert(#net == 52)
	-- la chauffe donne déjà la moyenne : investi dès la première semaine, un seul ordre
	local _, ordres = R.evaluer({ type = "tendance", semaines = 10, filtre = 0 }, prix, 100, 152)
	assert(ordres == 1)
end)

test("sélection : la moitié la moins bonne meurt", function()
	local robots = {}
	for i = 1, 31 do
		robots[i] = { id = i, gain = (i % 7) / 10, genome = R.genomeHasard(R.hasard(i)) }
	end
	local vivants, morts = R.selection(robots)
	assert(#vivants == 16 and #morts == 15)
	for _, m in morts do
		assert(m.gain <= vivants[#vivants].gain)
	end
	local e = R.enfants(vivants, 14, R.hasard(2), 100)
	assert(#e == 14 and e[1].id == 100 and e[14].id == 113)
end)

test("périodes : chauffe, entraînement puis examen", function()
	local p = R.periodes(520, 3, 52)
	assert(p.examen.fin == 520 and p.examen.debut == 468)
	assert(p.entrainement.fin == 468 and p.entrainement.debut == 468 - 156)
	local q = R.periodes(200, 3, 52)
	assert(q.ans == 1 and q.entrainement.debut - R.CHAUFFE >= 1)
	assert(R.periodes(120, 3, 52) == nil)
end)

test("textes en français", function()
	assert(R.pct(0.1234) == "+12,3 %", R.pct(0.1234))
	assert(R.pct(-0.05) == "-5,0 %")
end)

print(string.format("%d/%d tests réussis", nb - echecs, nb))
if echecs > 0 then
	error("des tests ont échoué")
end
