#!/usr/bin/env bash
# Adapte le projet Android généré par « cap add android » :
# permissions (GPS, appareil photo), numéro de version, icônes et écran de démarrage FSH.
# Usage : bash scripts/prepare-android.sh [numéro de build]
set -euo pipefail

cd "$(dirname "$0")/.."
BUILD="${1:-1}"
MANIFEST=android/app/src/main/AndroidManifest.xml
GRADLE=android/app/build.gradle

if ! grep -q 'ACCESS_FINE_LOCATION' "$MANIFEST"; then
  sed -i 's#<uses-permission android:name="android.permission.INTERNET" />#&\
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\
    <uses-permission android:name="android.permission.CAMERA" />\
    <uses-feature android:name="android.hardware.location.gps" android:required="false" />\
    <uses-feature android:name="android.hardware.camera" android:required="false" />#' "$MANIFEST"
fi
grep -q 'ACCESS_FINE_LOCATION' "$MANIFEST"

sed -i -E "s/versionCode [0-9]+/versionCode ${BUILD}/; s/versionName \"[^\"]*\"/versionName \"1.0.${BUILD}\"/" "$GRADLE"
grep -q "versionCode ${BUILD}" "$GRADLE"

cp -r native/android/res/. android/app/src/main/res/

echo "Projet Android prêt (version 1.0.${BUILD})."
