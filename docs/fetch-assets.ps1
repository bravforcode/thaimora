param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot), [switch]$Refresh, [string[]]$AssetNames = @())
$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath (Join-Path $ProjectRoot 'docs/assets-provenance.json') -Raw | ConvertFrom-Json
foreach ($asset in $manifest.assets) {
    if ($AssetNames.Count -gt 0 -and (Split-Path -Leaf $asset.path) -notin $AssetNames) { continue }
    $assetPath = Join-Path $ProjectRoot $asset.path
    $resolvedRoot = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if (-not [IO.Path]::GetFullPath($assetPath).StartsWith($resolvedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Asset path outside project' }
    New-Item -ItemType Directory -Path (Split-Path -Parent $assetPath) -Force | Out-Null
    if ($Refresh -or -not (Test-Path -LiteralPath $assetPath)) {
        Invoke-WebRequest -Uri $asset.url -OutFile $assetPath -Headers @{'User-Agent'='ThaimoraTaoTide/1.0 (licensed website assets)'}
    }
    $digest = Get-FileHash -LiteralPath $assetPath -Algorithm SHA256
    Write-Output "$($asset.path) $((Get-Item -LiteralPath $assetPath).Length) bytes SHA256=$($digest.Hash)"
}
