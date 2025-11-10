# Quick Asset Setup Guide

## The Issue

Expo needs these asset files to run:
- `assets/icon.png` (1024x1024)
- `assets/splash.png` (1284x2778)  
- `assets/adaptive-icon.png` (1024x1024)
- `assets/favicon.png` (48x48)

## Quick Fix - Option 1: Download Default Expo Assets

Run this in PowerShell:

```powershell
# Create assets directory
New-Item -ItemType Directory -Force -Path assets

# Download default Expo template assets
Invoke-WebRequest -Uri "https://github.com/expo/expo/raw/main/templates/expo-template-blank/assets/icon.png" -OutFile "assets/icon.png"
Invoke-WebRequest -Uri "https://github.com/expo/expo/raw/main/templates/expo-template-blank/assets/splash.png" -OutFile "assets/splash.png"
Invoke-WebRequest -Uri "https://github.com/expo/expo/raw/main/templates/expo-template-blank/assets/adaptive-icon.png" -OutFile "assets/adaptive-icon.png"
Invoke-WebRequest -Uri "https://github.com/expo/expo/raw/main/templates/expo-template-blank/assets/favicon.png" -OutFile "assets/favicon.png"
```

## Quick Fix - Option 2: Use Placeholder Tool

```powershell
npm run create-assets
```

Then convert the SVG files to PNG using an online tool or image editor.

## Quick Fix - Option 3: Create Simple Assets Manually

Create simple colored PNG files with any image editor:
- Use solid blue (#4A90E2) backgrounds
- Add white "SW" text in the center
- Save as PNG with the correct dimensions

## Recommended Tools

- **Canva** - Quick icon creation (free)
- **Figma** - Professional design tool (free)
- **GIMP** - Free image editor
- **Photoshop** - Professional (paid)
- Online converters: https://svgtopng.com/

## After Creating Assets

Once you have the PNG files in the `assets/` folder, run:

```powershell
npm start
```

The app should now load without errors!
