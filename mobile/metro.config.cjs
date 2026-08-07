const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const repositoryRoot = path.resolve(projectRoot, "..");
const config = getDefaultConfig(projectRoot);
const webcryptoShim = path.resolve(projectRoot, "src/shims/isomorphicWebcrypto.cjs");

config.watchFolders = [repositoryRoot];
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "isomorphic-webcrypto/src/react-native") {
    return { filePath: webcryptoShim, type: "sourceFile" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
