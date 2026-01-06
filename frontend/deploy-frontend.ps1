param(
    [string]$VmIp = "10.9.10.87",
    [string]$VmUser = "asist",
    [string]$RemoteDir = "/home/asist/spa-dist",
    [string]$IdentityFile = $env:SSH_IDENTITY_FILE
)

$ErrorActionPreference = "Stop"

if (-not $IdentityFile) {
    $defaultKey = Join-Path $HOME ".ssh/asist_vm_asist"
    if (Test-Path $defaultKey) {
        $IdentityFile = $defaultKey
    }
}

if ($IdentityFile) {
    Write-Host "Using SSH identity file: $IdentityFile"
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $ScriptDir

try {
    Write-Host "1) Installing frontend dependencies (if needed)..."
    $needsInstall = (-not (Test-Path "node_modules")) -or (-not (Test-Path "node_modules/flatpickr"))
    if ($needsInstall) {
        if (Test-Path "package-lock.json") {
            npm ci
        }
        else {
            npm install
        }
    }
    else {
        Write-Host "Dependencies already present; skipping install."
    }

    Write-Host "2) Building Angular (production)..."
    npx ng build --configuration production

    Write-Host "3) Uploading frontend to VM..."
    $scpArgs = @()
    if ($IdentityFile -and (Test-Path $IdentityFile)) {
        $scpArgs += "-i"
        $scpArgs += $IdentityFile
    }
    $scpArgs += "-r"
    $scpArgs += "dist/frontend/browser"
    $scpArgs += "${VmUser}@${VmIp}:${RemoteDir}"

    & scp @scpArgs

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to copy frontend to VM."
        exit 1
    }

    Write-Host "4) Fixing permissions on VM (avoid 403 from nginx)..."
    $sshArgs = @()
    if ($IdentityFile -and (Test-Path $IdentityFile)) {
        $sshArgs += "-i"
        $sshArgs += $IdentityFile
    }
    $sshArgs += "${VmUser}@${VmIp}"
    $sshArgs += "chmod -R a+rX ${RemoteDir}"

    & ssh @sshArgs

    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to chmod ${RemoteDir} on VM. If the site shows 403, run: chmod -R a+rX ${RemoteDir}"
    }

    Write-Host "Frontend successfully deployed to $RemoteDir/browser"
}
finally {
    Pop-Location
}