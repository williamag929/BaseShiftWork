module.exports = function (api) {
  api.cache(true);
  return {
    // Reanimated 4.x: babel-preset-expo adds the worklets plugin automatically.
    presets: ['babel-preset-expo'],
  };
};
