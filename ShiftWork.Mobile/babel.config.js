module.exports = function (api) {
  api.cache(true);
  const isTest = process.env.NODE_ENV === 'test';
  return {
    presets: [
      [
        'babel-preset-expo',
        // Disable the reanimated plugin in the Jest environment — the worklets
        // transformer is not available there; the reanimated mock handles tests.
        isTest ? { reanimated: false } : {},
      ],
    ],
    // No explicit react-native-reanimated/plugin entry needed for 4.x —
    // babel-preset-expo auto-includes it when reanimated option is not false.
  };
};
