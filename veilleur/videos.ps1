# Branche « Mes vidéos en ligne » au veilleur : notification sur l'iPhone dès qu'une vidéo sort sur YouTube (Metricool
# publie partout en même temps), avec les liens à partager. Gratuit : flux public de YouTube, pas d'API Metricool.
#   powershell -ExecutionPolicy Bypass -File veilleur\videos.ps1
# Pour chaque compte : un nom, l'identifiant de la chaîne YouTube (« UC… », dans l'adresse de la chaîne ou dans
# Metricool), et les pseudos TikTok / Instagram (facultatifs). Rangé dans le secret GitHub VIDEOS_COMPTES du dépôt
# privé des données, puis le workflow du veilleur est mis à jour.
$ErrorActionPreference = "Stop"
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Write-Host "Installe GitHub CLI : winget install GitHub.cli"; exit 1 }
gh auth status *> $null
if ($LASTEXITCODE -ne 0) { gh auth login -s workflow }
$synchro = Join-Path $env:LOCALAPPDATA "fr.rayan.launcher\data\rayans-aujourdhui\synchro.json"
if (-not (Test-Path $synchro)) { Write-Host "Synchro pas encore configurée dans Rayan's Aujourd'hui (onglet Synchro)."; exit 1 }
$repo = (Get-Content $synchro -Raw | ConvertFrom-Json).repo
if (-not $repo) { Write-Host "synchro.json incomplet."; exit 1 }
Write-Host "Dépôt des données : $repo"

$comptes = @()
while ($true) {
  Write-Host ""
  $nom = Read-Host "Nom du compte (ex. Ayati) — laisse vide pour terminer"
  if (-not $nom) { break }
  $yt = (Read-Host "  Chaîne YouTube (UC…)").Trim()
  if ($yt -notmatch '^UC[\w-]{22}$') { Write-Host "  ✗ identifiant de chaîne invalide, compte ignoré"; continue }
  $c = [ordered]@{ nom = $nom.Trim(); youtube = $yt }
  $tt = (Read-Host "  Pseudo TikTok (facultatif)").Trim(); if ($tt) { $c.tiktok = $tt }
  $ig = (Read-Host "  Pseudo Instagram (facultatif)").Trim(); if ($ig) { $c.instagram = $ig }
  $comptes += [pscustomobject]$c
  Write-Host "  ✓ $($c.nom) ajouté"
}
if (-not $comptes.Count) { Write-Host "Aucun compte : rien n'a été changé."; exit 1 }

(ConvertTo-Json -InputObject @($comptes) -Compress) | gh secret set VIDEOS_COMPTES --repo $repo
if ($LASTEXITCODE -ne 0) { Write-Host "✗ secret VIDEOS_COMPTES refusé"; exit 1 }
Write-Host "✓ secret VIDEOS_COMPTES ($($comptes.Count) compte(s))"

# Workflow du veilleur à jour (il transmet le secret).
$fichier = ".github/workflows/veilleur.yml"
$contenu = [IO.File]::ReadAllText((Join-Path $PSScriptRoot "modele\veilleur.yml"))
$sha = gh api "repos/$repo/contents/$fichier" --jq .sha 2>$null
$corps = @{ message = "Veilleur : vidéos en ligne"; content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($contenu)) }
if ($LASTEXITCODE -eq 0 -and $sha) { $corps.sha = "$sha".Trim() }
($corps | ConvertTo-Json -Compress) | gh api -X PUT "repos/$repo/contents/$fichier" --input - > $null
if ($LASTEXITCODE -ne 0) { Write-Host "✗ mise à jour du workflow refusée"; exit 1 }
Write-Host "✓ workflow veilleur.yml mis à jour"
gh workflow run veilleur.yml --repo $repo
Write-Host "✓ premier passage lancé : chaque nouvelle vidéo arrivera en notification (20 min au plus après sa sortie)."
