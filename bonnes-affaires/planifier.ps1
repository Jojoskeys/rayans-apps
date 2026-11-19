# Programme la recherche Bonnes Affaires chaque matin (tâche planifiée Windows « Rayan's Bonnes Affaires »).
#   powershell -ExecutionPolicy Bypass -File bonnes-affaires\planifier.ps1               (7 h 00)
#   powershell -ExecutionPolicy Bypass -File bonnes-affaires\planifier.ps1 -Heure 06:30
#   powershell -ExecutionPolicy Bypass -File bonnes-affaires\planifier.ps1 -Retirer
# La tâche tourne dans ta session, sans mot de passe enregistré ni droits administrateur. Si le PC est
# éteint à l'heure prévue, elle se lance dès qu'il est rallumé.
param([string]$Heure = "07:00", [switch]$Retirer)
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
$reglages = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 20)
$qui = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $nom -Action $action -Trigger $declencheur -Settings $reglages -Principal $qui `
  -Description "Recherche des bonnes affaires d'occasion et mise à jour de la tuile iPhone (rayans-apps\bonnes-affaires)." -Force | Out-Null
Write-Host "Recherche programmée chaque jour à $Heure. Compte rendu : $(Join-Path $PSScriptRoot 'resultats\journal.txt')"
