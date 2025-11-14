Param(
  [Parameter(Mandatory=$true)][ValidateSet('full','incremental','monthly')] [string]$Type,
  [string]$Out = 'backup_out'
)

$ErrorActionPreference = 'Stop'

if (-not $env:DB_CONNECTION) { throw 'DB_CONNECTION env var is required (postgres URL)' }
if (-not (Test-Path $Out)) { New-Item -ItemType Directory -Path $Out | Out-Null }

$tsDate = (Get-Date).ToUniversalTime().ToString('yyyyMMdd')
$tsFull = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmm')

switch ($Type) {
  'full'        { $outfile = Join-Path $Out "db-full-$tsDate.dump.gz" }
  'incremental' { $outfile = Join-Path $Out "db-inc-$tsFull.dump.gz" }
  'monthly'     { $outfile = Join-Path $Out "db-monthly-$tsDate.dump.gz" }
}

$tmpDump = [System.IO.Path]::GetTempFileName()
# Requires pg_dump in PATH (PostgreSQL client)
& pg_dump -Fc -d $env:DB_CONNECTION -f $tmpDump

# gzip
$inStream  = [System.IO.File]::OpenRead($tmpDump)
$outStream = [System.IO.File]::Create($outfile)
$gzip = New-Object System.IO.Compression.GzipStream($outStream, [IO.Compression.CompressionLevel]::Optimal)
$inStream.CopyTo($gzip)
$gzip.Dispose(); $inStream.Dispose(); $outStream.Dispose()
Remove-Item $tmpDump -Force

# sha256
$sha = (Get-FileHash -Algorithm SHA256 $outfile).Hash.ToLower()
Set-Content -Path ("$outfile.sha256") -Value $sha -Encoding ascii

# manifest
$manifest = @{ kind=$Type; timestamp_utc=$tsFull; file=(Split-Path -Leaf $outfile); sha256=$sha; db_type='postgres' } | ConvertTo-Json -Compress
Set-Content -Path (Join-Path $Out "manifest-$tsFull.json") -Value $manifest -Encoding utf8

Write-Host "Backup created: $outfile"
