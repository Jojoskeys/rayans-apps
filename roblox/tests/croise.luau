-- Outil des tests Python : comparer le port Luau à arene.py sur les mêmes prix.
-- luau tests/croise.luau -a "type=tendance,semaines=4,filtre=0" "100,101,99,..."
local R = require("../src/ReplicatedStorage/Arene/Regles")
local spec, liste = ...
local g = {}
for k, v in string.gmatch(spec, "(%w+)=([^,]+)") do
	g[k] = tonumber(v) or v
end
local prix = {}
for x in string.gmatch(liste, "[^,]+") do
	table.insert(prix, tonumber(x))
end
local net, ordres = R.rendements(R.positions(g, prix), prix)
local morceaux = {}
for _, r in net do
	table.insert(morceaux, string.format("%.12g", r))
end
print(ordres)
print(table.concat(morceaux, ","))
