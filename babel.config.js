module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // The worklets plugin. It MUST stay last in the plugin list — it rewrites
    // function bodies into worklets, so anything running after it would be
    // transforming already-serialised code.
    //
    // On Reanimated 4 this *is* the Reanimated plugin.
    // `react-native-reanimated/plugin` is a three-line re-export of exactly
    // this module, kept so v2/v3 configs keep working; naming it here would
    // add a layer of indirection and nothing else, and listing both would
    // register the same transform twice. Moti rides on Reanimated and needs no
    // plugin of its own.
    plugins: ["react-native-worklets/plugin"],
  };
};
