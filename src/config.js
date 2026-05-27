import { readFileSync, existsSync, watchFile, unwatchFile, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { homedir } from 'os';
import { error as logError } from './log.js';

let currentConfig = null;
let configPath = '';
let reloadCallback = null;
let ignoredWatchEvents = 0;

/**
 * Validates server config object
 * @param {object} server
 * @returns {boolean}
 */
function validateServerConfig(server) {
  if (!server || typeof server !== 'object') return false;
  if (!server.name || typeof server.name !== 'string') return false;
  if (server.url !== undefined && typeof server.url !== 'string') return false;
  if (server.command !== undefined && typeof server.command !== 'string') return false;
  if (server.args !== undefined && !Array.isArray(server.args)) return false;
  if (server.env !== undefined && typeof server.env !== 'object') return false;
  if (server.enabledTools !== undefined && !Array.isArray(server.enabledTools)) return false;
  return true;
}

/**
 * Validates a profile object
 * @param {object} profile
 * @returns {boolean}
 */
function validateProfile(profile) {
  if (!profile || typeof profile !== 'object') return false;
  if (!profile.name || typeof profile.name !== 'string') return false;
  if (!Array.isArray(profile.servers)) return false;
  for (const s of profile.servers) {
    if (typeof s !== 'string') return false;
  }
  return true;
}

/**
 * Validates full config object
 * @param {object} config
 * @returns {boolean}
 */
function validateConfig(config) {
  if (!config || typeof config !== 'object') return false;
  if (!Array.isArray(config.servers)) return false;
  for (const server of config.servers) {
    if (!validateServerConfig(server)) return false;
  }
  // profiles is optional for backward compatibility
  if (config.profiles !== undefined) {
    if (!Array.isArray(config.profiles)) return false;
    for (const profile of config.profiles) {
      if (!validateProfile(profile)) return false;
    }
  }
  // activeProfile is optional
  if (config.activeProfile !== undefined && typeof config.activeProfile !== 'string') return false;
  return true;
}

/**
 * Load config from JSON file
 * @param {string} path
 * @returns {object}
 */
export function loadConfig(path) {
  const resolvedPath = resolve(path);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  const content = readFileSync(resolvedPath, 'utf-8');
  const parsed = JSON.parse(content);

  if (!validateConfig(parsed)) {
    throw new Error(`Invalid config file: ${resolvedPath}`);
  }

  currentConfig = parsed;
  configPath = resolvedPath;

  return parsed;
}

/**
 * Get currently loaded config
 * @returns {object|null}
 */
export function getConfig() {
  return currentConfig;
}

/**
 * Watch config file for changes
 * @param {Function} callback
 */
export function watchConfig(callback) {
  if (!configPath) {
    throw new Error('No config loaded yet');
  }

  reloadCallback = callback;

  watchFile(configPath, { interval: 1000 }, () => {
    if (ignoredWatchEvents > 0) {
      ignoredWatchEvents -= 1;
      return;
    }
    logError('[mcp-center] Config file changed, reloading...');
    try {
      const newConfig = loadConfig(configPath);
      logError(`[mcp-center] Loaded ${newConfig.servers.length} server(s)`);
      if (reloadCallback) {
        reloadCallback();
      }
    } catch (error) {
      logError('[mcp-center] Error reloading config:', error);
    }
  });
}

/**
 * Stop watching config file
 */
export function unwatchConfig() {
  if (configPath) {
    unwatchFile(configPath);
    reloadCallback = null;
  }
}

/**
 * Get the default config path (~/.mcp-center/mcp.json)
 * @returns {string}
 */
export function getDefaultConfigPath() {
  return resolve(homedir(), '.mcp-center', 'mcp.json');
}

/**
 * Ensure default config file exists
 * @returns {string} Path to config file
 */
export function ensureDefaultConfig() {
  const defaultPath = getDefaultConfigPath();
  const dir = dirname(defaultPath);
  
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  if (!existsSync(defaultPath)) {
    writeFileSync(defaultPath, JSON.stringify({ servers: [] }, null, 2), 'utf-8');
  }
  
  return defaultPath;
}

// ===== Profile Operations =====

/**
 * Get all profiles from config
 * @returns {Array}
 */
export function getProfiles() {
  return currentConfig?.profiles || [];
}

/**
 * Get the currently active profile name
 * @returns {string|null}
 */
export function getActiveProfile() {
  return currentConfig?.activeProfile || null;
}

/**
 * Create a new profile
 * @param {string} name
 * @param {string[]} serverNames
 * @returns {object} The created profile
 */
export function createProfile(name, serverNames) {
  if (!currentConfig) throw new Error('No config loaded');
  if (!name || typeof name !== 'string') throw new Error('Profile name is required');
  if (!Array.isArray(serverNames)) throw new Error('Server names must be an array');

  // Check duplicate name
  if ((currentConfig.profiles || []).some(p => p.name === name)) {
    throw new Error(`Profile "${name}" already exists`);
  }

  if (!currentConfig.profiles) currentConfig.profiles = [];
  const profile = { name, servers: serverNames };
  currentConfig.profiles.push(profile);
  saveConfig(currentConfig);
  return profile;
}

/**
 * Update an existing profile
 * @param {string} name
 * @param {{ name?: string, servers?: string[] }} updates
 * @returns {object} The updated profile
 */
export function updateProfile(name, updates) {
  if (!currentConfig) throw new Error('No config loaded');
  const profiles = currentConfig.profiles || [];
  const idx = profiles.findIndex(p => p.name === name);
  if (idx === -1) throw new Error(`Profile "${name}" not found`);

  if (updates.name && updates.name !== name) {
    // Check new name doesn't conflict
    if (profiles.some(p => p.name === updates.name)) {
      throw new Error(`Profile "${updates.name}" already exists`);
    }
    profiles[idx].name = updates.name;
    // Update activeProfile if renamed
    if (currentConfig.activeProfile === name) {
      currentConfig.activeProfile = updates.name;
    }
  }
  if (updates.servers) {
    profiles[idx].servers = updates.servers;
  }

  saveConfig(currentConfig);
  return profiles[idx];
}

/**
 * Delete a profile by name
 * @param {string} name
 * @returns {boolean} true if deleted
 */
export function deleteProfile(name) {
  if (!currentConfig) throw new Error('No config loaded');
  const profiles = currentConfig.profiles || [];
  const idx = profiles.findIndex(p => p.name === name);
  if (idx === -1) throw new Error(`Profile "${name}" not found`);

  profiles.splice(idx, 1);
  // Clear activeProfile if this was the active one
  if (currentConfig.activeProfile === name) {
    delete currentConfig.activeProfile;
  }

  saveConfig(currentConfig);
  return true;
}

/**
 * Activate a profile: enable servers in the profile, disable others
 * @param {string} name
 * @returns {{ activated: string[], disabled: string[], skipped: string[] }}
 */
export function activateProfile(name) {
  if (!currentConfig) throw new Error('No config loaded');
  const profiles = currentConfig.profiles || [];
  const profile = profiles.find(p => p.name === name);
  if (!profile) throw new Error(`Profile "${name}" not found`);

  const serverNamesInProfile = new Set(profile.servers);
  const allServerNames = new Set(currentConfig.servers.map(s => s.name));
  const activated = [];
  const disabled = [];
  const skipped = [];

  for (const server of currentConfig.servers) {
    if (serverNamesInProfile.has(server.name)) {
      if (allServerNames.has(server.name)) {
        server.enabled = true;
        activated.push(server.name);
      }
    } else {
      server.enabled = false;
      disabled.push(server.name);
    }
  }

  // Warn about servers in profile that don't exist in config
  for (const sn of profile.servers) {
    if (!allServerNames.has(sn)) {
      skipped.push(sn);
    }
  }

  currentConfig.activeProfile = name;
  saveConfig(currentConfig);

  return { activated, disabled, skipped };
}

/**
 * Deactivate the current profile (re-enable all servers)
 * @returns {void}
 */
export function deactivateProfile() {
  if (!currentConfig) throw new Error('No config loaded');
  delete currentConfig.activeProfile;

  // Re-enable all servers
  for (const server of currentConfig.servers) {
    server.enabled = true;
  }

  saveConfig(currentConfig);
}

/**
 * Save config to file
 * @param {object} config
 * @param {string} path
 */
export function saveConfig(config, path) {
  const resolvedPath = path || configPath;
  if (!resolvedPath) {
    throw new Error('No config path specified');
  }
  
  if (!validateConfig(config)) {
    throw new Error('Invalid config object');
  }

  const dir = dirname(resolvedPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(resolvedPath, JSON.stringify(config, null, 2), 'utf-8');
  ignoredWatchEvents += 1;
  currentConfig = config;
}
