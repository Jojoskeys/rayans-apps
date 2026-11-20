# Programme le bot Discord (tâche planifiée Windows « Rayan's Bonnes Affaires - Discord ») : jour et nuit,
# toutes les 5 minutes, sans fenêtre. Chaque passage lit Dealabs (et eBay si les clés sont là) et poste les
# nouvelles affaires dans le salon Discord du webhook de reglages.json.
#   powershell -ExecutionPolicy Bypass -File bonnes-affaires\planifier-bot.ps1
#   powershell -ExecutionPolicy Bypass -File bonnes-affaires\planifier-bot.ps1 -Intervalle 10
#   powershell -ExecutionPolicy Bypass -File bonnes-affaires\planifier-bot.ps1 -Retirer
# La tâche tourne dans ta session, sans mot de passe enregistré ni droits administrateur.
param([int]$Intervalle = 5, [switch]$Retirer)
$ErrorActionPreference = "Stop"
$nom = "Rayan's Bonnes Affaires - Discord"

if ($Retirer) {
  Unregister-ScheduledTask -TaskName $nom -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Bot Discord arrêté."
  exit 0
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Write-Host "Node.js introuvable : installe-le d'abord (winget install OpenJS.NodeJS.LTS)."; exit 1 }
$script = Join-Path $PSScriptRoot "lancer.ps1"
# conhost --headless : aucune fenêtre ne clignote toutes les 5 minutes.
$action = New-ScheduledTaskAction -Execute "conhost.exe" `
  -Argument "--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$script`" -Node `"$node`" -Bot" `
  -WorkingDirectory $PSScriptRoot
$declencheur = New-ScheduledTaskTrigger -Daily -At "00:00"
$declencheur.Repetition = (New-ScheduledTaskTrigger -Once -At "00:00" -RepetitionInterval (New-TimeSpan -Minutes $Intervalle) -RepetitionDuration (New-TimeSpan -Hours 24)).Repetition
$reglages = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 4)
$qui = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $nom -Action $action -Trigger $declencheur -Settings $reglages -Principal $qui `
  -Description "Bot Discord des bonnes affaires : Dealabs et eBay toutes les $Intervalle minutes (rayans-apps\bonnes-affaires)." -Force | Out-Null
Start-ScheduledTask -TaskName $nom
Write-Host "Bot Discord programmé toutes les $Intervalle minutes, jour et nuit. Compte rendu : $(Join-Path $PSScriptRoot 'resultats\journal-bot.txt')"
