const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// @firebase/util 1.15.x ships ESM/CJS that import `./postinstall.mjs`, but that file
// is NOT included in dist — Metro fails to resolve it and the whole bundle crashes.
// Redirect that one import to a local stub (getDefaultsFromPostinstall → undefined).
const firebasePostinstallStub = path.resolve(projectRoot, 'metro-stubs/firebase-postinstall.js');
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.endsWith('postinstall.mjs') &&
    context.originModulePath &&
    context.originModulePath.includes(`${path.sep}@firebase${path.sep}util${path.sep}`)
  ) {
    return { type: 'sourceFile', filePath: firebasePostinstallStub };
  }
  return (defaultResolveRequest || context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
