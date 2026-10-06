// Expo's app.json `intentFilters` can only express android.intent.action.* actions, and a tag tap
// arrives as android.nfc.action.NDEF_DISCOVERED. React Native's Linking reads that intent's URI, so
// expo-router opens /t/<key> the same way as a normal app link.
const TAG_HOST = 't.loqzen.com';
const TAG_PATH_PREFIX = '/t/';
const NDEF_DISCOVERED = 'android.nfc.action.NDEF_DISCOVERED';

function addNfcTagIntent(androidManifest) {
  const manifest = androidManifest.manifest;

  manifest['uses-feature'] = manifest['uses-feature'] || [];
  if (!manifest['uses-feature'].some((f) => f.$['android:name'] === 'android.hardware.nfc')) {
    // Optional, so the Play Store still offers the app to phones without NFC.
    manifest['uses-feature'].push({ $: { 'android:name': 'android.hardware.nfc', 'android:required': 'false' } });
  }

  const activity = manifest.application[0].activity.find((a) => a.$['android:name'] === '.MainActivity');
  activity['intent-filter'] = activity['intent-filter'] || [];
  const hasFilter = activity['intent-filter'].some((f) =>
    (f.action || []).some((a) => a.$['android:name'] === NDEF_DISCOVERED));
  if (!hasFilter) {
    activity['intent-filter'].push({
      action: [{ $: { 'android:name': NDEF_DISCOVERED } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      data: [{ $: { 'android:scheme': 'https', 'android:host': TAG_HOST, 'android:pathPrefix': TAG_PATH_PREFIX } }],
    });
  }
  return androidManifest;
}

function withNfcTagIntent(config) {
  const { withAndroidManifest } = require('expo/config-plugins');
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = addNfcTagIntent(cfg.modResults);
    return cfg;
  });
}

module.exports = withNfcTagIntent;
module.exports.addNfcTagIntent = addNfcTagIntent;
