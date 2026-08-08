const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const repositoryRoot = path.resolve(projectRoot, "..");
const config = getDefaultConfig(projectRoot);
const webcryptoShim = path.resolve(projectRoot, "src/shims/isomorphicWebcrypto.cjs");

config.resolver.assetExts.push("html");

config.watchFolders = [repositoryRoot];
// Hierarchical lookup stays OFF so shared repo-root source (src/sync, src/db)
// can never resolve a second yjs/js-base64 copy out of the desktop's
// node_modules — one Yjs instance is correctness-critical. The cost: npm's
// nested dedup (e.g. @expo/log-box under expo/node_modules) is invisible to a
// single-path lookup, so the known nesting points are listed explicitly.
// Failure mode is a loud UnableToResolveError naming the missing package —
// add its parent node_modules here if that ever happens again.
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(projectRoot, "node_modules/expo/node_modules"),
];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "isomorphic-webcrypto/src/react-native") {
    return { filePath: webcryptoShim, type: "sourceFile" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
