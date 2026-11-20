# Branche « Ton monde ce matin » au veilleur : range la clé Claude (secret ANTHROPIC_API_KEY) dans le dépôt privé
# des données, met à jour le workflow du veilleur depuis le modèle, puis lance un premier passage.
#   powershell -ExecutionPolicy Bypass -File veilleur\actu.ps1
# La clé est tapée masquée et part directement dans les secrets GitHub : elle ne s'affiche jamais et n'est écrite
# nulle part sur le PC. Sans clé, la newsletter marche quand même (édition gratuite : rubriques, titres, début du chapô, images, liens).
$ErrorActionPreference = "Stop"
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Write-Host "Installe GitHub CLI : winget install GitHub.cli"; exit 1 }
gh auth status *> $null
if ($LASTEXITCODE -ne 0) { gh auth login -s workflow }
$synchro = Join-Path $env:LOCALAPPDATA "fr.rayan.launcher\data\rayans-aujourdhui\synchro.json"
if (-not (Test-Path $synchro)) { Write-Host "Synchro pas encore configurée dans Rayan's Aujourd'hui (onglet Synchro)."; exit 1 }
$repo = (Get-Content $synchro -Raw | ConvertFrom-Json).repo
if (-not $repo) { Write-Host "synchro.json incomplet."; exit 1 }
Write-Host "Dépôt des données : $repo"

$sec = Read-Host "Clé Claude (sk-ant-…, console.anthropic.com → API Keys) — laisse vide pour garder l'actuelle" -AsSecureString
$cle = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)).Trim()
if ($cle) {
  if ($cle -notmatch '^sk-ant-') { Write-Host "✗ ça ne ressemble pas à une clé Claude (elle commence par sk-ant-)"; exit 1 }
  $cle | gh secret set ANTHROPIC_API_KEY --repo $repo
  if ($LASTEXITCODE -ne 0) { Write-Host "✗ secret ANTHROPIC_API_KEY refusé"; exit 1 }
  Write-Host "✓ secret ANTHROPIC_API_KEY enregistré"
}
$cle = $null

# Workflow du veilleur à jour (il transmet la clé).
$fichier = ".github/workflows/veilleur.yml"
$contenu = [IO.File]::ReadAllText((Join-Path $PSScriptRoot "modele\veilleur.yml"))
$sha = gh api "repos/$repo/contents/$fichier" --jq .sha 2>$null
$corps = @{ message = "Veilleur : Ton monde ce matin"; content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($contenu)) }
if ($LASTEXITCODE -eq 0 -and $sha) { $corps.sha = "$sha".Trim() }
($corps | ConvertTo-Json -Compress) | gh api -X PUT "repos/$repo/contents/$fichier" --input - > $null
if ($LASTEXITCODE -ne 0) { Write-Host "✗ mise à jour du workflow refusée"; exit 1 }
Write-Host "✓ workflow veilleur.yml mis à jour"
gh workflow run veilleur.yml --repo $repo
Write-Host "✓ passage lancé : « Ton monde ce matin » arrivera demain vers 6 h 40 (réglable dans Rayan's Mobile → Notifications)."
