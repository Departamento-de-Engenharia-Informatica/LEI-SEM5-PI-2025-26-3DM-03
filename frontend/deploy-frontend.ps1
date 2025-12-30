$ErrorActionPreference = "Stop"

$VM_IP = "10.9.10.87"
$VM_USER = "asist"
$REMOTE_DIR = "/home/asist/spa-dist"

Write-Host "1) Building Angular (production)..."
ng build --configuration production

Write-Host "2) Uploading frontend to VM..."
scp -r "dist/frontend/browser" "${VM_USER}@${VM_IP}:${REMOTE_DIR}"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to copy frontend to VM."
    exit 1
}

Write-Host "Frontend successfully deployed to $REMOTE_DIR/browser"