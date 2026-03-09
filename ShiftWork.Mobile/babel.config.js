module.exports = function (api) {
  api.cache(true);
  const isTest = process.env.NODE_ENV === 'test';
  return {
    presets: [
      [
        'babel-preset-expo',
        // babel-preset-expo auto-includes react-native-reanimated/plugin which
        // requires react-native-worklets — not available in Jest environment.
        // Disable it; react-native-reanimated/mock handles tests instead.
        isTest ? { reanimated: false } : {},
      ],
    ],
    plugins: [
      // react-native-reanimated MUST be the last plugin (only in non-test builds)
      ...(isTest ? [] : ['react-native-reanimated/plugin']),
    ],
  };
};
