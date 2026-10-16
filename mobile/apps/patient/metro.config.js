const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// npm workspaces: this app's code lives here, the shared package in ../../packages/shared,
// and every dependency in ../../node_modules.
const workspaceRoot = path.resolve(__dirname, '../..');
const src = path.resolve(__dirname, 'src');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  // Only what this app imports from outside its own folder: not the other apps or their
  // native build output.
  watchFolders: [path.resolve(workspaceRoot, 'node_modules'), path.resolve(workspaceRoot, 'packages')],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules'), path.resolve(workspaceRoot, 'node_modules')],
    // "@/hooks/useTeam" → "<app>/src/hooks/useTeam" (same alias as tsconfig.json and vite.config.ts)
    resolveRequest: (context, moduleName, platform) =>
      context.resolveRequest(context, moduleName.startsWith('@/') ? path.join(src, moduleName.slice(2)) : moduleName, platform),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
