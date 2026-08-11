const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

/**
 * Metro, taught where a pnpm workspace keeps things.
 *
 * Metro watches only the project folder by default, so an edit in `packages/*`
 * would never trigger a rebuild. Watching the workspace root fixes that, and
 * naming both `node_modules` roots lets a module resolve whether it was
 * installed for this app or shared at the root.
 *
 * What is deliberately *not* set here is `resolver.disableHierarchicalLookup`.
 * Every npm/yarn monorepo guide turns it on, because under a hoisted layout the
 * parent walk is how you end up with two copies of React. pnpm inverts that: a
 * package's dependencies live beside it inside the store, reachable only by
 * walking up from it, so switching the walk off breaks React Native's own
 * transitive requires — `invariant` is the first to go — while the isolated
 * layout already rules out the duplicate the flag exists to prevent.
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
