const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable package.json `exports` field resolution (stable in Expo SDK 53+).
// Required for Firebase 10+ so Metro picks the correct React Native bundles
// instead of falling back to the ESM/browser builds, which caused:
//   Error: Component auth has not been registered yet
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
