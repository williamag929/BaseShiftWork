# Assets Directory

✅ **Assets have been set up!**

This folder contains the app's image and icon assets.

## Required Assets

The following assets need to be created for the app:

### App Icons
- **icon.png** (1024x1024) - Main app icon
- **adaptive-icon.png** (1024x1024) - Android adaptive icon foreground
- **favicon.png** (48x48) - Web favicon

### Splash Screen
- **splash.png** (1284x2778) - Launch screen image

## Generating Assets

You can use online tools or design software to create these assets:

1. **Figma** - Design icons and export
2. **Canva** - Quick icon creation
3. **Icon Kitchen** - Android adaptive icons
4. **Expo Icon Generator** - Automated asset generation

### Quick Setup with Expo

Use Expo's asset generation:

```bash
npx expo-asset-generator path/to/your-icon.png
```

## Temporary Placeholders

For development, you can use simple colored squares as placeholders.

## Asset Specifications

### icon.png
- Size: 1024x1024 pixels
- Format: PNG with transparency
- Used for: iOS and Android app icon

### adaptive-icon.png
- Size: 1024x1024 pixels
- Format: PNG with transparency
- Safe zone: Keep content within inner 768x768 circle
- Used for: Android adaptive icon

### splash.png
- Size: 1284x2778 pixels (or larger)
- Format: PNG
- Center content within safe area
- Used for: Launch screen

### favicon.png
- Size: 48x48 pixels (or 32x32)
- Format: PNG or ICO
- Used for: Web app favicon
