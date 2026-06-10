# ShiftWork Mobile — Paused Status

Status: Paused for later. This file summarizes what’s done, what’s pending, and exactly how to resume.

## Current State
- Expo SDK 50 (RN 0.73, React 18) with dependencies installed.
- Native Android prebuild completed; `AndroidManifest.xml` includes `android.permission.DETECT_SCREEN_CAPTURE`.
- Installed: `expo-screen-capture`, `expo-system-ui`; ran `expo prebuild -p android`.
- TypeScript fixes applied (standardized event types). Type-check passes; ESLint warnings acceptable.
- Metro can start in dev-client mode.

## Issues Encountered (context)
- SecurityException on Android 14 when using Expo Go: requires `DETECT_SCREEN_CAPTURE`. Solution is to use a Dev Client build (not Expo Go).
- `JAVA_HOME` was pointed at Android Studio’s JBR; Gradle requires a real JDK 17 (e.g., Temurin 17).
- “main has not been registered” appeared when Metro wasn’t paired with the correct dev client or cache was stale.

## Resume Checklist (Windows PowerShell)
Run these from `C:\projects\BaseShiftWork\ShiftWork.Mobile`.

```powershell
# 0) Ensure Java 17 for this terminal (auto-detect in common locations)
$roots = @(
  "C:\\Program Files\\Eclipse Adoptium",
  "C:\\Program Files\\Microsoft",
  "C:\\Program Files\\Java"
)
$jdk = $null
foreach ($root in $roots) {
  if (Test-Path $root) {
    $candidate = Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like "jdk-17*" } |
      Sort-Object Name -Descending |
      Select-Object -First 1 -ExpandProperty FullName
    if ($candidate -and (Test-Path "$candidate\\bin\\java.exe")) { $jdk = $candidate; break }
  }
}
if (-not $jdk) { Write-Error "JDK 17 not found. Install Temurin 17 (x64): https://adoptium.net/temurin/releases/?version=17"; exit 1 }
$env:JAVA_HOME = $jdk
$env:Path = "$env:JAVA_HOME\\bin;$env:Path"
java -version

# 1) Ensure an emulator or device is connected
adb devices
# If none listed, start an AVD via Android Studio (Device Manager) or CLI:
# emulator -avd Pixel_7_API_34

# 2) Avoid launching Expo Go by mistake
adb uninstall host.exp.exponent

# 3) Build & install the Dev Client (package: com.williamaguirre82.baseshiftwork)
npx expo run:android

# 4) Start Metro in Dev Client mode (from ShiftWork.Mobile)
npx expo start --dev-client -c
# If 8081 is busy: npx expo start --dev-client --port 8082 -c
```

On the device/emulator, open the installed app “ShiftWork Mobile” (this is the Dev Client), then connect to the running Metro bundler.

## Quick Verification
```powershell
# Confirm the app is installed
adb shell pm list packages | findstr baseshi
adb shell pm path com.williamaguirre82.baseshiftwork

# Verify the permission is present
adb shell dumpsys package com.williamaguirre82.baseshiftwork | findstr DETECT_SCREEN_CAPTURE
```

## Notes
- Do not use Expo Go on Android 14 for this project; the required permission isn’t included there.
- If Gradle/JDK errors appear, re-run the Java 17 setup above and re-try `npx expo run:android`.
