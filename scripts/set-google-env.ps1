<#
Set-google-env.ps1

Usage (PowerShell):
  .\set-google-env.ps1 -ClientId "YOUR_CLIENT_ID" -ClientSecret "YOUR_CLIENT_SECRET"

This script persists the Google OIDC client id/secret to the current user's environment
using setx so that processes (after restart) will see the variables:
  Authentication__Google__ClientId
  Authentication__Google__ClientSecret

Security note: these values are secrets. Do not commit them to source control.
#>

param(
    [Parameter(Mandatory=$true)] [string] $ClientId,
    [Parameter(Mandatory=$true)] [string] $ClientSecret
)

Write-Host "Setting persistent user environment variables for Google OIDC (setx)" -ForegroundColor Yellow

try {
    setx Authentication__Google__ClientId "$ClientId" | Out-Null
    setx Authentication__Google__ClientSecret "$ClientSecret" | Out-Null

    Write-Host "Done. Variables written to the current user environment." -ForegroundColor Green
    Write-Host "Important: open a NEW PowerShell / restart VS Code for the variables to be available to new processes." -ForegroundColor Cyan
    Write-Host "To verify in a new terminal run:`n  echo $env:Authentication__Google__ClientId`n  echo $env:Authentication__Google__ClientSecret" -ForegroundColor Gray
}
catch {
    Write-Error "Failed to set environment variables: $_"
    exit 1
}

# Optional helper to remove the variables (uncomment to use)
# [Environment]::SetEnvironmentVariable('Authentication__Google__ClientId', $null, 'User')
# [Environment]::SetEnvironmentVariable('Authentication__Google__ClientSecret', $null, 'User')
