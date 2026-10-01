const { addNfcTagIntent } = require('../withNfcTagIntent');

const baseManifest = () => ({
  manifest: {
    application: [{ activity: [{ $: { 'android:name': '.MainActivity' }, 'intent-filter': [] }] }],
  },
});

it('adds the NDEF_DISCOVERED filter for tag links and an optional NFC feature', () => {
  const result = addNfcTagIntent(baseManifest());
  const filters = result.manifest.application[0].activity[0]['intent-filter'];
  const ndef = filters.find((f) => f.action[0].$['android:name'] === 'android.nfc.action.NDEF_DISCOVERED');

  expect(ndef.category[0].$['android:name']).toBe('android.intent.category.DEFAULT');
  expect(ndef.data[0].$).toEqual({ 'android:scheme': 'https', 'android:host': 't.loqzen.com', 'android:pathPrefix': '/t/' });
  expect(result.manifest['uses-feature']).toEqual([{ $: { 'android:name': 'android.hardware.nfc', 'android:required': 'false' } }]);
});

it('is idempotent', () => {
  const once = addNfcTagIntent(baseManifest());
  const twice = addNfcTagIntent(once);
  expect(twice.manifest.application[0].activity[0]['intent-filter']).toHaveLength(1);
  expect(twice.manifest['uses-feature']).toHaveLength(1);
});
