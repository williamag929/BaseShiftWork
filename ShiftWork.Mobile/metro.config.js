const { getDefaultConfig } = require('expo/metro-config');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');

const config = getDefaultConfig(__dirname);

// Enable package.json `exports` field resolution (stable in Expo SDK 53+).
// Required for Firebase 10+ so Metro picks the correct React Native bundles.
config.resolver.unstable_enablePackageExports = true;

// Required for react-native-reanimated 4.x — registers the worklets transformer
// and collapses reanimated internal frames in stack traces.
module.exports = wrapWithReanimatedMetroConfig(config);
