# Programme la recherche Bonnes Affaires (tâche planifiée Windows « Rayan's Bonnes Affaires ») : chaque jour
# de 7 h à 23 h, toutes les 30 minutes. Chaque passage interroge eBay (API officielle, si les clés sont là),
# reclasse le dernier relevé et met à jour la tuile ; une nouvelle pépite part en notification sur l'iPhone.
#   powershell -ExecutionPolicy Bypass -File bonnes-affaires\planifier.ps1
#   powershell -ExecutionPolicy Bypass -File bonnes-affaires\planifier.ps1 -Heure 06:30 -Intervalle 15
#   powershell -ExecutionPolicy Bypass -File bonnes-affaires\planifier.ps1 -Intervalle 0     (une fois par jour)
#   powershell -ExecutionPolicy Bypass -File bonnes-affaires\planifier.ps1 -Retirer
# La tâche tourne dans ta session, sans mot de passe enregistré ni droits administrateur. Si le PC est
# éteint à l'heure prévue, elle se lance dès qu'il est rallumé.
param([string]$Heure = "07:00", [int]$Intervalle = 30, [int]$Heures = 16, [switch]$Retirer)
$ErrorActionPreference = "Stop"
$nom = "Rayan's Bonnes Affaires"

if ($Retirer) {
  Unregister-ScheduledTask -TaskName $nom -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Recherche du matin retirée."
  exit 0
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Write-Host "Node.js introuvable : installe-le d'abord (winget install OpenJS.NodeJS.LTS)."; exit 1 }
$script = Join-Path $PSScriptRoot "lancer.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`" -Node `"$node`"" `
  -WorkingDirectory $PSScriptRoot
$declencheur = New-ScheduledTaskTrigger -Daily -At $Heure
if ($Intervalle -gt 0) {
  # Répétition dans la journée : reprise d'un déclencheur « une fois » (seul moyen de la régler en PowerShell).
  $declencheur.Repetition = (New-ScheduledTaskTrigger -Once -At $Heure -RepetitionInterval (New-TimeSpan -Minutes $Intervalle) -RepetitionDuration (New-TimeSpan -Hours $Heures)).Repetition
}
$reglages = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 20)
$qui = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $nom -Action $action -Trigger $declencheur -Settings $reglages -Principal $qui `
  -Description "Recherche des bonnes affaires d'occasion et mise à jour de la tuile iPhone (rayans-apps\bonnes-affaires)." -Force | Out-Null
$quand = if ($Intervalle -gt 0) { "chaque jour à partir de $Heure, toutes les $Intervalle minutes pendant $Heures h" } else { "chaque jour à $Heure" }
Write-Host "Recherche programmée $quand. Compte rendu : $(Join-Path $PSScriptRoot 'resultats\journal.txt')"
