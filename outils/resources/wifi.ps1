# Réseau Wi-Fi connecté et sa clé, lue dans le profil enregistré par Windows (netsh wlan export … key=clear).
# L'export XML ne dépend pas de la langue de Windows. Le fichier exporté est supprimé aussitôt.
# Sortie : JSON {"connecte": bool, "ssid": "...", "securite": "WPA2PSK", "cle": "..."} sur une ligne.
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$interfaces = (netsh wlan show interfaces) -join "`n"
$ssid = $null
foreach ($l in ($interfaces -split "`n")) {
  if ($l -match '^\s*SSID\s*:\s*(.+?)\s*$') { $ssid = $Matches[1]; break }
}
if (-not $ssid) {
  ConvertTo-Json -Compress -InputObject ([ordered]@{ connecte = $false; ssid = $null; securite = $null; cle = $null })
  exit 0
}

$dir = Join-Path ([IO.Path]::GetTempPath()) ("rayans-outils-wifi-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $dir | Out-Null
try {
  netsh wlan export profile name="$ssid" key=clear folder="$dir" | Out-Null
  $file = Get-ChildItem -Path $dir -Filter *.xml | Select-Object -First 1
  if (-not $file) { throw "Profil Wi-Fi introuvable pour « $ssid »." }
  [xml]$xml = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
  $sec = $xml.WLANProfile.MSM.security
  $cle = $sec.sharedKey.keyMaterial
  ConvertTo-Json -Compress -InputObject ([ordered]@{ connecte = $true; ssid = $ssid; securite = $sec.authEncryption.authentication; cle = $cle })
} finally {
  Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
}
