# Compile les apps Garmin (Connect IQ) pour la Forerunner 165 et range les .prg dans garmin\sortie.
#   .\construire.ps1                 # toutes les apps, fr165
#   .\construire.ps1 -Appareil fr165m
#   .\construire.ps1 -Apps muscu
#   .\construire.ps1 -Tests          # compile en version de test et lance les tests dans le simulateur
#   .\construire.ps1 -Installer      # compile et copie sur la montre branchée en USB
# Rayan's Montre : l'adresse du PC et le code montre viennent de montre\config.local.json (jamais dans le dépôt,
# modèle : montre\config.exemple.json), écrits dans montre\source-config\Config.mc (généré, ignoré par git).
# SDK : celui choisi dans le Connect IQ SDK Manager. Clé : %APPDATA%\Garmin\ConnectIQ\developer_key.der
# (créée une fois, jamais dans le dépôt).
param(
    [string]$Appareil = "fr165",
    [string[]]$Apps = @("cadran-priere", "champ-5km", "muscu", "montre"),
    [switch]$Tests,
    [switch]$Installer
)
$ErrorActionPreference = "Stop"
$ici = Split-Path -Parent $MyInvocation.MyCommand.Path
$ciq = Join-Path $env:APPDATA "Garmin\ConnectIQ"
$sdk = (Get-Content (Join-Path $ciq "current-sdk.cfg") -Raw).Trim().TrimEnd('\')
$monkeyc = Join-Path $sdk "bin\monkeyc.bat"
$cle = Join-Path $ciq "developer_key.der"
if (-not (Test-Path $monkeyc)) { throw "SDK introuvable : $sdk (ouvrir le Connect IQ SDK Manager)" }
if (-not (Test-Path $cle)) { throw "Clé de développeur absente : $cle" }
if (-not (Test-Path (Join-Path $ciq "Devices\$Appareil"))) {
    throw "Fichiers de la montre $Appareil absents : Connect IQ SDK Manager > Devices > Forerunner 165 > Download"
}
$sortie = Join-Path $ici $(if ($Tests) { "sortie\tests" } else { "sortie" })
New-Item -ItemType Directory -Force $sortie | Out-Null
if ($Tests -and -not (Get-Process simulator -ErrorAction SilentlyContinue)) {
    Start-Process (Join-Path $sdk "bin\simulator.exe"); Start-Sleep 8
}
# Config.mc de Rayan's Montre depuis config.local.json (sans fichier : app compilée « non configurée »).
function Ecrire-ConfigMontre {
    $local = Join-Path $ici "montre\config.local.json"
    $adresse = ""; $code = ""
    if (Test-Path $local) {
        $c = Get-Content $local -Raw -Encoding UTF8 | ConvertFrom-Json
        $adresse = ([string]$c.adresse).Trim().TrimEnd('/')
        $code = ([string]$c.code).Trim()
        if ($adresse -notmatch '^https://[A-Za-z0-9.-]+(:\d+)?$') { throw "montre\config.local.json : adresse attendue comme https://nom-du-pc.xxxx.ts.net" }
        if ($code -notmatch '^[A-Za-z0-9-]{20,40}$') { throw "montre\config.local.json : code montre attendu (affiché dans Rayan's Télécommande sur le PC)" }
    } else {
        Write-Host "   montre\config.local.json absent : l'app dira « config absente » (modèle : config.exemple.json)" -ForegroundColor Yellow
    }
    $dossier = Join-Path $ici "montre\source-config"
    New-Item -ItemType Directory -Force $dossier | Out-Null
    $mc = @"
// Généré par construire.ps1 depuis config.local.json : ne pas modifier, jamais dans le dépôt.
import Toybox.Lang;

module Config {
    const ADRESSE = "$adresse";
    const CODE = "$code";
}
"@
    [IO.File]::WriteAllText((Join-Path $dossier "Config.mc"), $mc, (New-Object Text.UTF8Encoding $false))
}

$echecs = 0
foreach ($app in $Apps) {
    if ($app -eq "montre") { Ecrire-ConfigMontre }
    $prg = Join-Path $sortie "$app.prg"
    Write-Host "== $app ($Appareil)"
    $options = @("-f", (Join-Path $ici "$app\monkey.jungle"), "-o", $prg, "-y", $cle, "-d", $Appareil, "-w")
    if ($Tests) { $options += "--unit-test" }
    $ErrorActionPreference = "Continue"   # monkeyc écrit ses avertissements sur stderr
    & $monkeyc @options 2>&1 | ForEach-Object { "   $_" }
    $code = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    if ($code -ne 0) { $echecs++; Write-Host "   ECHEC de la compilation" -ForegroundColor Red; continue }
    if (-not $Tests) { Write-Host "   -> $prg" -ForegroundColor Green; continue }
    # Tests : monkeydo peut rester bloqué si le simulateur ne répond pas, d'où la limite de temps.
    $job = Start-Job { param($s, $p, $d) & (Join-Path $s "bin\monkeydo.bat") $p $d /t 2>&1 } -ArgumentList $sdk, $prg, $Appareil
    if (-not (Wait-Job $job -Timeout 120)) { Stop-Job $job; $echecs++; Write-Host "   ECHEC : délai dépassé" -ForegroundColor Red; continue }
    $res = Receive-Job $job
    $res | Select-String "DEBUG|ERROR|PASS|FAIL" | ForEach-Object { "   $_" }
    if (-not ($res | Select-String "^PASSED")) { $echecs++; Write-Host "   ECHEC des tests" -ForegroundColor Red }
}
if ($echecs -gt 0) { exit 1 }

# -Installer : copie les .prg sur la montre branchée en USB (appareil MTP, via l'Explorateur). Une copie ne
# remplace pas un fichier existant sur la montre : l'ancienne version est d'abord déplacée vers le PC.
if ($Installer -and -not $Tests) {
    $sh = New-Object -ComObject Shell.Application
    $montre = $sh.NameSpace(17).Items() | Where-Object { $_.Path -match 'usb#vid_091e' } | Select-Object -First 1
    if (-not $montre) { throw "Montre Garmin non trouvée : la brancher en USB." }
    $dossierApps = (($montre.GetFolder.Items() | Select-Object -First 1).GetFolder.Items() | Where-Object Name -eq "GARMIN").GetFolder.Items() | Where-Object Name -eq "Apps"
    $anciens = Join-Path $env:TEMP "rayans-garmin-anciens"
    New-Item -ItemType Directory -Force $anciens | Out-Null
    foreach ($app in $Apps) {
        $vieux = $dossierApps.GetFolder.Items() | Where-Object Name -eq "$app.prg"
        if ($vieux) { Remove-Item -Force (Join-Path $anciens "$app.prg") -ErrorAction SilentlyContinue; $sh.NameSpace($anciens).MoveHere($vieux, 0x14); Start-Sleep 3 }
        $dossierApps.GetFolder.CopyHere((Join-Path $sortie "$app.prg"), 0x14)
        Start-Sleep 3
        Write-Host "   $app installée sur $($montre.Name)" -ForegroundColor Green
    }
}
