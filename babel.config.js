module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // react-native-worklets/plugin powers Reanimated 4 (used by the drawer
    // navigator). It MUST stay last in the plugin list.
    plugins: ["react-native-worklets/plugin"],
  };
};
