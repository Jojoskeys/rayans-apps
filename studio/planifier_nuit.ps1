# Enregistre (ou retire) la tâche planifiée Windows « Rayan's Studio - fabrication de nuit » : python nuit.py à 2 h.
# NE PAS lancer sans l'accord de Rayan.
#   powershell -ExecutionPolicy Bypass -File planifier_nuit.ps1            enregistre la tâche
#   powershell -ExecutionPolicy Bypass -File planifier_nuit.ps1 -Retirer   la supprime
# La tâche ne réveille pas l'écran ni le PC (WakeToRun désactivé), n'éteint rien à la fin, et s'arrête après 5 h.
param([switch]$Retirer)

$nom = "Rayan's Studio - fabrication de nuit"
if ($Retirer) {
    Unregister-ScheduledTask -TaskName $nom -Confirm:$false
    Write-Output "Tâche retirée : $nom"
    return
}

$python = (Get-Command python).Source
$action = New-ScheduledTaskAction -Execute $python -Argument "nuit.py" -WorkingDirectory $PSScriptRoot
$quand = New-ScheduledTaskTrigger -Daily -At "02:00"
$reglages = New-ScheduledTaskSettingsSet -StartWhenAvailable:$false -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 5) -MultipleInstances IgnoreNew
$reglages.WakeToRun = $false
# Lancée seulement quand l'utilisateur est connecté (pas de mot de passe enregistré), fenêtre réduite par Windows.
Register-ScheduledTask -TaskName $nom -Action $action -Trigger $quand -Settings $reglages `
    -Description "Fabrique les scripts validés et les dépose dans la tuile Studio. Ne publie rien." | Out-Null
Write-Output "Tâche enregistrée : $nom (tous les jours à 2 h). Journal : sorties\nuit\<date>.txt"
