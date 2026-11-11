# Setup script: downloads yt-dlp.exe into Backend/bin/
$binDir = Join-Path $PSScriptRoot "bin"
if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir | Out-Null }

$ytdlpPath = Join-Path $binDir "yt-dlp.exe"
if (-not (Test-Path $ytdlpPath)) {
    Write-Host "Downloading yt-dlp.exe..." -ForegroundColor Cyan
    $url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    Invoke-WebRequest -Uri $url -OutFile $ytdlpPath
    Write-Host "yt-dlp.exe downloaded to: $ytdlpPath" -ForegroundColor Green
} else {
    Write-Host "yt-dlp.exe already exists at: $ytdlpPath" -ForegroundColor Yellow
    Write-Host "Updating yt-dlp..." -ForegroundColor Cyan
    & $ytdlpPath -U
}

Write-Host "`nDone! You can now run: npm start" -ForegroundColor Green
