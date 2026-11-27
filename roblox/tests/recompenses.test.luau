-- Tests des récompenses quotidiennes :  luau tests/recompenses.test.luau   (depuis roblox/)
local Rec = require("../src/ReplicatedStorage/Arene/Recompenses")

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

test("7 récompenses, grosses aux jours 2 et 7, aucune en argent du jeu", function()
	assert(#Rec.LISTE == 7)
	for i, r in Rec.LISTE do
		assert(r.jour == i)
		assert(r.grosse == (i == 2 or i == 7), "jour " .. i)
		assert(not string.find(string.lower(r.genre), "argent") and not string.find(string.lower(r.nom), "pièces"))
	end
end)

test("première fois : jour 1", function()
	local d, r = Rec.appliquer(nil, 100)
	assert(r.jour == 1 and d.dernier == 100 and d.serie == 1 and #d.objets == 1)
end)

test("même jour : rien de plus", function()
	local d = Rec.appliquer(nil, 100)
	local d2, r2 = Rec.appliquer(d, 100)
	assert(d2 == nil and r2 == nil)
	assert(Rec.etat(d, 100).droit == false)
end)

test("lendemain : jour 2 (grosse), puis la série monte", function()
	local d = Rec.appliquer(nil, 100)
	local d2, r2 = Rec.appliquer(d, 101)
	assert(r2.jour == 2 and r2.grosse and d2.serie == 2)
	local cur = d2
	for jour = 3, 7 do
		local _, r = nil, nil
		cur, r = Rec.appliquer(cur, 99 + jour)
		assert(r.jour == jour, "jour " .. jour)
	end
	assert(Rec.LISTE[7].grosse)
end)

test("après le jour 7 la série repart au jour 1", function()
	local e = Rec.etat({ dernier = 106, serie = 7, objets = {} }, 107)
	assert(e.droit and e.jour == 1)
end)

test("un jour manqué : retour au jour 1", function()
	local e = Rec.etat({ dernier = 100, serie = 4, objets = { "x" } }, 102)
	assert(e.droit and e.jour == 1)
end)

test("l'entrée n'est pas modifiée et les objets s'accumulent sans doublon", function()
	local avant = { dernier = 100, serie = 1, objets = { "Étincelle bleue" } }
	local d = Rec.appliquer(avant, 101)
	assert(#avant.objets == 1 and avant.dernier == 100)
	assert(#d.objets == 2)
	local d2 = Rec.appliquer({ dernier = 100, serie = 1, objets = { "Robot argenté" } }, 101)
	assert(#d2.objets == 1)
end)

test("numéro du jour UTC", function()
	assert(Rec.numeroJour(0) == 0 and Rec.numeroJour(86399) == 0 and Rec.numeroJour(86400) == 1)
end)

print(string.format("%d tests, %d échec(s)", nb, echecs))
if echecs == 0 then
	print("tests réussis")
else
	error("des tests ont échoué")
end
