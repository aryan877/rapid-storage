const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// NativeWind v4 + Expo SDK 53 specific configuration
config.resolver.unstable_enablePackageExports = false;
config.resolver.sourceExts.push('css');

module.exports = withNativeWind(config, { input: './global.css' });
