# Met en place le veilleur en ligne (notifications iPhone + emploi du temps sans le PC). À lancer UNE fois, sur le PC :
#   powershell -ExecutionPolicy Bypass -File veilleur\configurer.ps1
# Les secrets (clé de chiffrement, clé d'envoi) vont directement dans les secrets GitHub du dépôt privé :
# ils ne s'affichent jamais. Option : -NouvellesCles pour régénérer les clés de notification.
param([switch]$NouvellesCles, [switch]$Essai)
$ErrorActionPreference = "Stop"
$racine = Split-Path -Parent $PSScriptRoot
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Write-Host "Installe GitHub CLI : winget install GitHub.cli"; exit 1 }
gh auth status *> $null
if ($LASTEXITCODE -ne 0) { gh auth login -s workflow }
$electron = Join-Path $racine "aujourdhui\node_modules\electron\dist\electron.exe"
if (-not (Test-Path $electron)) { Write-Host "Electron introuvable : lance « npm install » dans aujourdhui\"; exit 1 }
$args2 = @('"' + (Join-Path $PSScriptRoot "scripts\configurer-cle.cjs") + '"')
if ($NouvellesCles) { $args2 += "--nouvelles-cles" }
if ($Essai) { $args2 += "--essai" }
# electron.exe est une app fenêtrée : Start-Process -Wait pour attendre la fin et lire le code de retour.
$p = Start-Process -FilePath $electron -ArgumentList $args2 -NoNewWindow -Wait -PassThru
if ($p.ExitCode -eq 0 -and -not $Essai) { Write-Host "`nVeilleur prêt. Sur l'iPhone : ouvre Rayan's Mobile depuis l'écran d'accueil, puis Synchro → « Activer les notifications »." }
