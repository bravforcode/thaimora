param(
 [Parameter(Mandatory)][string]$ProjectRoot,
 [Parameter(Mandatory)][ValidatePattern('^[a-z]{20}$')][string]$ProjectRef,
 [Parameter(Mandatory)][ValidateSet('thaimora','taotide')][string]$Site
)
$ErrorActionPreference='Stop'
$root=[System.IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\','/')
if($root -ne [System.IO.Path]::GetFullPath("C:/Users/menum/Projects/$Site").TrimEnd('\','/')){throw 'Unexpected project root'}
$path=Join-Path $root '.env.production.local'
$acl=Get-Acl -LiteralPath $path
$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
if(-not $acl.AreAccessRulesProtected -or $acl.GetOwner([System.Security.Principal.SecurityIdentifier]) -ne $sid -or @($acl.Access).Count -ne 1 -or $acl.Access[0].IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]) -ne $sid){throw 'Private env must have verified owner-only access'}
$values=@{}
foreach($line in [System.IO.File]::ReadAllLines($path)){if($line -match '^([A-Z_]+)=(.*)$'){$values[$Matches[1]]=$Matches[2].Trim('"')}}
$base="https://$ProjectRef.supabase.co"
if($values['SUPABASE_URL'] -ne $base -or -not $values['SUPABASE_SERVICE_ROLE_KEY'] -or $values['CONTENT_SYNC_SECRET'] -notmatch '^[a-f0-9]{64}$'){throw 'Expected private backend configuration is missing'}
$request=@{p_worker_secret=$values['CONTENT_SYNC_SECRET'];p_api_url=($base+'/functions/v1/sync-content')}|ConvertTo-Json -Compress
try{$receipt=Invoke-RestMethod -Method Post -Uri ($base+'/rest/v1/rpc/configure_content_scheduler') -Headers @{apikey=$values['SUPABASE_SERVICE_ROLE_KEY'];Authorization=('Bearer '+$values['SUPABASE_SERVICE_ROLE_KEY'])} -ContentType 'application/json' -Body $request -TimeoutSec 30}catch{throw 'Private scheduler configuration failed; secret values suppressed'}
if($receipt.configured -ne $true -or $receipt.schedule -ne '*/5 * * * *' -or [int64]$receipt.jobId -lt 1){throw 'Unexpected scheduler receipt'}
$safe=@{site=$Site;projectRef=$ProjectRef;configuredAt=[DateTimeOffset]::UtcNow.ToString('o');configured=$true;jobId=[int64]$receipt.jobId;schedule=[string]$receipt.schedule;privateSecretStoredInVault=$true}
$evidence=Join-Path $root 'docs/evidence/content-scheduler-configured.json'
[System.IO.File]::WriteAllText($evidence,($safe|ConvertTo-Json -Depth 3)+"`n",[System.Text.UTF8Encoding]::new($false))
$safe|ConvertTo-Json -Compress
