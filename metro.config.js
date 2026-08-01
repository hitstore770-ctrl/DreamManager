const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite's web backend (wa-sqlite) ships a .wasm binary that Metro
// only bundles if the extension is registered as an asset type.
config.resolver.assetExts.push("wasm");

module.exports = config;
