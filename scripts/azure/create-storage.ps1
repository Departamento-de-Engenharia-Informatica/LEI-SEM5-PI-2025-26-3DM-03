Param(
  [Parameter(Mandatory=$true)][string]$ResourceGroup,
  [Parameter(Mandatory=$true)][string]$Location,
  [Parameter(Mandatory=$true)][string]$StorageAccount,
  [Parameter(Mandatory=$true)][string]$Container
)

$ErrorActionPreference = 'Stop'

# Requires: Az.Accounts, Az.Storage modules and an interactive or federated login (az login / Connect-AzAccount)

Write-Host "Ensuring resource group..."
$rg = Get-AzResourceGroup -Name $ResourceGroup -ErrorAction SilentlyContinue
if (-not $rg) { New-AzResourceGroup -Name $ResourceGroup -Location $Location | Out-Null }

Write-Host "Ensuring storage account..."
$sa = Get-AzStorageAccount -ResourceGroupName $ResourceGroup -Name $StorageAccount -ErrorAction SilentlyContinue
if (-not $sa) {
  New-AzStorageAccount -ResourceGroupName $ResourceGroup -Name $StorageAccount -Location $Location -SkuName Standard_LRS -Kind StorageV2 | Out-Null
  $sa = Get-AzStorageAccount -ResourceGroupName $ResourceGroup -Name $StorageAccount
}

$ctx = $sa.Context

Write-Host "Ensuring blob container..."
$cont = Get-AzStorageContainer -Context $ctx -Name $Container -ErrorAction SilentlyContinue
if (-not $cont) { New-AzStorageContainer -Context $ctx -Name $Container -Permission Off | Out-Null }

Write-Host "Applying lifecycle policy (expire incremental after 7 days, full after 30 days)..."
$policy = @'
{
  "rules": [
    {"enabled": true, "name": "expire-incremental-7d", "type": "Lifecycle", "definition": {"actions": {"baseBlob": {"delete": {"daysAfterModificationGreaterThan": 7}}}, "filters": {"blobTypes": ["blockBlob"], "prefixMatch": ["incremental/"]}}},
    {"enabled": true, "name": "expire-full-30d", "type": "Lifecycle", "definition": {"actions": {"baseBlob": {"delete": {"daysAfterModificationGreaterThan": 30}}}, "filters": {"blobTypes": ["blockBlob"], "prefixMatch": ["full/"]}}}
  ]
}
'@
Set-AzStorageBlobServiceProperty -ResourceGroupName $ResourceGroup -AccountName $StorageAccount -ServiceType Blob -DefaultServiceVersion "2020-06-12" -DeleteRetentionPolicyInDays 7 | Out-Null

Write-Host "Done."
