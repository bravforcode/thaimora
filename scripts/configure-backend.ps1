param(
  [Parameter(Mandatory)][string]$ProjectRoot,
  [Parameter(Mandatory)][ValidatePattern('^[a-z]{20}$')][string]$ProjectRef,
  [Parameter(Mandatory)][ValidateSet('thaimora','taotide')][string]$Site,
  [Parameter(Mandatory)][string]$SiteUrl,
  [Parameter(Mandatory)][ValidatePattern('^team_[A-Za-z0-9]+$')][string]$VercelOrgId,
  [Parameter(Mandatory)][ValidatePattern('^prj_[A-Za-z0-9]+$')][string]$VercelProjectId
)
$ErrorActionPreference='Stop'
$projectPath=[System.IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\','/')
$expected=[System.IO.Path]::GetFullPath("C:/Users/menum/Projects/$Site").TrimEnd('\','/')
if($projectPath -ne $expected){throw 'Project root does not match the selected site'}
$uri=[uri]$SiteUrl
if($uri.Scheme -ne 'https' -or $uri.Port -ne 443 -or $uri.UserInfo -or $uri.AbsolutePath -ne '/' -or $uri.Query -or $uri.Fragment -or $uri.Host -in @('localhost','127.0.0.1','::1','[::1]','example.com') -or $uri.Host -match '\.(test|invalid|example|example\.com)$'){throw 'Verified canonical HTTPS site origin required'}
$origin=$uri.GetLeftPart([System.UriPartial]::Authority)
$envPath=Join-Path $projectPath '.env.production.local'
function Protect-PrivateFile([string]$PrivatePath){
  # Create an empty file first: secret content is written only after DACL verification.
  if(-not (Test-Path -LiteralPath $PrivatePath)){
    $emptyFile=[System.IO.File]::Open($PrivatePath,[System.IO.FileMode]::CreateNew,[System.IO.FileAccess]::Write,[System.IO.FileShare]::None)
    $emptyFile.Dispose()
  }
  $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
  $existingAcl=Get-Acl -LiteralPath $PrivatePath
  if($existingAcl.GetOwner([System.Security.Principal.SecurityIdentifier]) -ne $sid){throw 'Private file belongs to another user; refusing ownership change'}
  $existingRules=@($existingAcl.Access)
  if($existingAcl.AreAccessRulesProtected -and $existingRules.Count -eq 1 -and $existingRules[0].IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]) -eq $sid -and $existingRules[0].AccessControlType -eq 'Allow' -and $existingRules[0].FileSystemRights -eq 'FullControl'){return}
  $fileInfo=[System.IO.FileInfo]::new($PrivatePath)
  $acl=[System.IO.FileSystemAclExtensions]::GetAccessControl($fileInfo,[System.Security.AccessControl.AccessControlSections]::Access)
  $acl.SetAccessRuleProtection($true,$false)
  foreach($rule in @($acl.Access)){if($null -ne $rule){[void]$acl.RemoveAccessRuleSpecific($rule)}}
  $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','Allow'))
  [System.IO.FileSystemAclExtensions]::SetAccessControl($fileInfo,$acl)
  $check=Get-Acl -LiteralPath $PrivatePath
  $rules=@($check.Access)
  if(-not $check.AreAccessRulesProtected -or $rules.Count -ne 1 -or $rules[0].IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]) -ne $sid -or $rules[0].AccessControlType -ne 'Allow' -or $rules[0].FileSystemRights -ne 'FullControl'){throw 'Private DACL verification failed before writing keys'}
}
Protect-PrivateFile $envPath
$outputPath=Join-Path $projectPath 'scripts/output/production'
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
$edgeEnvPath=Join-Path $outputPath 'edge-secrets.env'
Protect-PrivateFile $edgeEnvPath
$envLines=[System.Collections.Generic.List[string]]::new()
if(Test-Path -LiteralPath $envPath){$envLines.AddRange([System.IO.File]::ReadAllLines($envPath))}
function Read-EnvValue([string]$Name){
  $line=$envLines | Where-Object {$_ -match ('^'+[regex]::Escape($Name)+'=')} | Select-Object -Last 1
  if($line){return $line.Substring($Name.Length+1).Trim('"')};return ''
}
function Set-EnvValue([string]$Name,[string]$Value){
  if($Value -match '[\r\n\x00]'){throw 'Multiline env value rejected'}
  for($i=$envLines.Count-1;$i -ge 0;$i--){if($envLines[$i] -match ('^'+[regex]::Escape($Name)+'=')){$envLines.RemoveAt($i)}}
  $envLines.Add($Name+'='+$Value)
}
function New-PrivateRandom(){return [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()}
$backendUrl="https://$ProjectRef.supabase.co"
$oldUrl=Read-EnvValue 'SUPABASE_URL'
if($oldUrl -and $oldUrl -ne $backendUrl){throw 'Existing env points to another backend; refusing overwrite'}
# Capture keys in memory. Never echo CLI output, secret values, or command-line secrets.
$keyText=(& supabase projects api-keys --project-ref $ProjectRef --output json 2>$null) -join "`n"
if($LASTEXITCODE -ne 0){throw 'Authenticated Supabase key lookup failed'}
try{$keyRecords=$keyText | ConvertFrom-Json}catch{throw 'Invalid Supabase key response'}
$service=($keyRecords | Where-Object {$_.name -eq 'service_role' -and $_.type -eq 'legacy' -and $_.disabled -ne $true} | Select-Object -First 1).api_key
$publishable=($keyRecords | Where-Object {$_.type -eq 'publishable' -and $_.disabled -ne $true} | Select-Object -First 1).api_key
if(-not $service -or -not $publishable -or $service -eq $publishable -or $publishable -notmatch '^sb_publishable_'){throw 'Expected private service and public publishable keys unavailable'}
Set-EnvValue 'SUPABASE_URL' $backendUrl
Set-EnvValue 'SUPABASE_SERVICE_ROLE_KEY' $service
Set-EnvValue 'NEXT_PUBLIC_SUPABASE_URL' $backendUrl
Set-EnvValue 'NEXT_PUBLIC_SUPABASE_ANON_KEY' $publishable
Set-EnvValue 'NEXT_PUBLIC_API_URL' ($backendUrl+'/functions/v1/api')
Set-EnvValue 'NEXT_PUBLIC_SITE_URL' $origin
Set-EnvValue $(if($Site -eq 'thaimora'){'NEXT_PUBLIC_DATA_MODE'}else{'NEXT_PUBLIC_APP_MODE'}) 'live'
Set-EnvValue 'ALLOWED_ORIGINS' $origin
Set-EnvValue 'HOSTING_PROVIDER' 'vercel'
Set-EnvValue 'VERCEL_ORG_ID' $VercelOrgId
Set-EnvValue 'VERCEL_PROJECT_ID' $VercelProjectId
Set-EnvValue 'AUTOMATION_ENABLED' 'false'
Set-EnvValue 'POI_LICENSE_CONFIRMED' 'true'
Set-EnvValue 'CONTENT_BBOX' $(if($Site -eq 'thaimora'){'98.2,7.7,98.5,8.2'}else{'99.818,10.055,99.87,10.129'})
$salt=Read-EnvValue 'RATE_LIMIT_SALT'
if(-not $salt){$salt=New-PrivateRandom;Set-EnvValue 'RATE_LIMIT_SALT' $salt}
$secretLines=@(('ALLOWED_ORIGINS='+$origin),('RATE_LIMIT_SALT='+$salt))
if($Site -eq 'thaimora'){
  $worker=Read-EnvValue 'EMAIL_WORKER_SECRET'
  if(-not $worker){$worker=New-PrivateRandom;Set-EnvValue 'EMAIL_WORKER_SECRET' $worker}
  $secretLines+=('EMAIL_WORKER_SECRET='+$worker)
}
if($secretLines.Count -ne $(if($Site -eq 'thaimora'){3}else{2}) -or $secretLines[0] -ne ('ALLOWED_ORIGINS='+$origin) -or $secretLines[1] -notmatch '^RATE_LIMIT_SALT=[a-f0-9]{64}$'){
  throw 'Edge secret file validation failed before upload'
}
$utf8=[System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllLines($envPath,$envLines,$utf8)
[System.IO.File]::WriteAllLines($edgeEnvPath,$secretLines,$utf8)
$secretResult=(& supabase secrets set --project-ref $ProjectRef --env-file $edgeEnvPath 2>&1) -join "`n"
if($LASTEXITCODE -ne 0){throw 'Supabase secret upload failed; private env preserved for retry'}
$linkPath=Join-Path $projectPath '.vercel'
New-Item -ItemType Directory -Path $linkPath -Force | Out-Null
[System.IO.File]::WriteAllText((Join-Path $linkPath 'project.json'),(@{projectId=$VercelProjectId;orgId=$VercelOrgId;projectName=$Site}|ConvertTo-Json -Compress)+"`n",$utf8)
[pscustomobject]@{site=$Site;projectRef=$ProjectRef;siteOrigin=$origin;publicKeyType='publishable';envSaved=$true;edgeSecretsUploaded=$true;deploymentPerformed=$false}|ConvertTo-Json -Compress
