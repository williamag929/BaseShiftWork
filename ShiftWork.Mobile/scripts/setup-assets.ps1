# PowerShell script to create placeholder PNG assets
# This creates simple colored PNG files for Expo development

$assetsPath = Join-Path $PSScriptRoot "..\assets"

# Create assets directory if it doesn't exist
if (-not (Test-Path $assetsPath)) {
    New-Item -ItemType Directory -Force -Path $assetsPath | Out-Null
}

Write-Host "Creating placeholder assets..." -ForegroundColor Cyan

# We'll create a simple text file to indicate placeholders are needed
$readmePath = Join-Path $assetsPath "PLACEHOLDER_NEEDED.txt"
$readmeContent = @"
PLACEHOLDER ASSETS REQUIRED

The following PNG files are needed:
- icon.png (1024x1024)
- adaptive-icon.png (1024x1024)
- splash.png (1284x2778)
- favicon.png (48x48)

QUICK FIX:
1. Visit https://www.placeholder.com/
2. Create images with the required dimensions
3. Download as PNG and place in this assets folder
4. Delete this PLACEHOLDER_NEEDED.txt file
5. Run 'npm start' again

OR use the Expo asset generator:
npx @expo/image-utils generate-icons --foreground path/to/your-logo.png

OR download from GitHub:
https://github.com/expo/expo/tree/main/templates/expo-template-blank/assets
"@

$readmeContent | Out-File -FilePath $readmePath -Encoding utf8

Write-Host "✅ Assets folder created at: $assetsPath" -ForegroundColor Green
Write-Host "⚠️  PNG assets are required. See PLACEHOLDER_NEEDED.txt for instructions." -ForegroundColor Yellow
Write-Host ""
Write-Host "Quick download command:" -ForegroundColor Cyan
Write-Host "git clone --depth 1 --filter=blob:none --sparse https://github.com/expo/expo.git temp-expo" -ForegroundColor White
Write-Host "cd temp-expo" -ForegroundColor White  
Write-Host "git sparse-checkout set templates/expo-template-blank/assets" -ForegroundColor White
Write-Host "Copy-Item -Recurse templates/expo-template-blank/assets/* ../assets/" -ForegroundColor White
Write-Host "cd .." -ForegroundColor White
Write-Host "Remove-Item -Recurse -Force temp-expo" -ForegroundColor White
