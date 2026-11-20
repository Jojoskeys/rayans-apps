# Lance une recherche Bonnes Affaires, sans fenêtre. Appelé chaque matin par la tâche planifiée
# « Rayan's Bonnes Affaires » (voir planifier.ps1). Le compte rendu va dans resultats\journal.txt.
# Avec -Bot, lance un passage du bot Discord (voir planifier-bot.ps1), compte rendu dans resultats\journal-bot.txt.
param([string]$Node = "node", [switch]$Bot)
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
# Node écrit en UTF-8 : sans ça, Windows PowerShell abîme les accents du journal.
[Console]::OutputEncoding = [Text.Encoding]::UTF8
New-Item -ItemType Directory -Force (Join-Path $PSScriptRoot "resultats") | Out-Null
$journal = Join-Path $PSScriptRoot $(if ($Bot) { "resultats\journal-bot.txt" } else { "resultats\journal.txt" })
# Le journal garde seulement les 500 dernières lignes.
if (Test-Path $journal) { Get-Content $journal -Tail 500 -Encoding UTF8 | Set-Content "$journal.tmp" -Encoding UTF8; Move-Item -Force "$journal.tmp" $journal }
Add-Content $journal "`n===== $(Get-Date -Format 'yyyy-MM-dd HH:mm') =====" -Encoding UTF8
& $Node $(if ($Bot) { "src/bot.ts" } else { "src/main.ts" }) 2>&1 | ForEach-Object { "$_" } | Add-Content $journal -Encoding UTF8
Add-Content $journal "(fin, code $LASTEXITCODE)" -Encoding UTF8
exit $LASTEXITCODE
