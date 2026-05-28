/**
 * Tests for Profile feature (config.js profile operations)
 */

import { writeFileSync, mkdirSync, existsSync, unlinkSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { loadConfig, createProfile, getProfiles, getActiveProfile, activateProfile, deactivateProfile, updateProfile, deleteProfile, saveConfig } from '../src/config.js';

const TEST_DIR = resolve(tmpdir(), 'mcp-center-profile-test-' + Date.now());

// Helper to create a temp config file
function createTestConfig(data) {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
  const configPath = resolve(TEST_DIR, 'mcp.json');
  writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
  return configPath;
}

// Cleanup
afterAll(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe('Profile operations', () => {
  let configPath;

  beforeEach(() => {
    configPath = createTestConfig({
      servers: [
        { name: 'server-a', url: 'http://localhost:3001/mcp' },
        { name: 'server-b', url: 'http://localhost:3002/mcp' },
        { name: 'server-c', command: 'node', args: ['server.js'] },
      ]
    });
    loadConfig(configPath);
  });

  test('getProfiles returns empty array when no profiles', () => {
    const profiles = getProfiles();
    expect(profiles).toEqual([]);
  });

  test('getActiveProfile returns null when none active', () => {
    const active = getActiveProfile();
    expect(active).toBeNull();
  });

  test('createProfile creates a new profile', () => {
    const profile = createProfile('dev-mode', ['server-a', 'server-b']);
    expect(profile.name).toBe('dev-mode');
    expect(profile.servers).toEqual(['server-a', 'server-b']);
  });

  test('createProfile rejects duplicate name', () => {
    createProfile('dev-mode', ['server-a']);
    expect(() => createProfile('dev-mode', ['server-b'])).toThrow('already exists');
  });

  test('getProfiles returns created profiles', () => {
    createProfile('dev-mode', ['server-a', 'server-b']);
    createProfile('writing-mode', ['server-c']);
    const profiles = getProfiles();
    expect(profiles).toHaveLength(2);
    expect(profiles[0].name).toBe('dev-mode');
    expect(profiles[1].name).toBe('writing-mode');
  });

  test('activateProfile enables selected servers and disables others', () => {
    createProfile('dev-mode', ['server-a', 'server-c']);
    const result = activateProfile('dev-mode');
    expect(result.activated).toEqual(['server-a', 'server-c']);
    expect(result.disabled).toEqual(['server-b']);
    expect(result.skipped).toEqual([]);
    expect(getActiveProfile()).toBe('dev-mode');
  });

  test('activateProfile reports skipped servers not in config', () => {
    createProfile('bad-profile', ['server-a', 'nonexistent']);
    const result = activateProfile('bad-profile');
    expect(result.activated).toEqual(['server-a']);
    expect(result.disabled).toEqual(['server-b', 'server-c']);
    expect(result.skipped).toEqual(['nonexistent']);
  });

  test('activateProfile throws for nonexistent profile', () => {
    expect(() => activateProfile('no-such-profile')).toThrow('not found');
  });

  test('deactivateProfile re-enables all servers', () => {
    createProfile('dev-mode', ['server-a']);
    activateProfile('dev-mode');
    deactivateProfile();
    expect(getActiveProfile()).toBeNull();
    const config = loadConfig(configPath);
    expect(config.servers.every(s => s.enabled !== false)).toBe(true);
  });

  test('updateProfile can rename and change servers', () => {
    createProfile('old-name', ['server-a']);
    const updated = updateProfile('old-name', { name: 'new-name', servers: ['server-b', 'server-c'] });
    expect(updated.name).toBe('new-name');
    expect(updated.servers).toEqual(['server-b', 'server-c']);
    // Old name should no longer exist
    const profiles = getProfiles();
    expect(profiles.find(p => p.name === 'old-name')).toBeUndefined();
  });

  test('updateProfile updates activeProfile when renamed', () => {
    createProfile('active-one', ['server-a']);
    activateProfile('active-one');
    updateProfile('active-one', { name: 'renamed-active' });
    expect(getActiveProfile()).toBe('renamed-active');
  });

  test('deleteProfile removes profile and clears activeProfile if active', () => {
    createProfile('to-delete', ['server-a']);
    activateProfile('to-delete');
    deleteProfile('to-delete');
    expect(getProfiles()).toHaveLength(0);
    expect(getActiveProfile()).toBeNull();
  });

  test('backward compatibility: config without profiles/activeProfile loads fine', () => {
    const barePath = createTestConfig({ servers: [{ name: 'test', url: 'http://localhost' }] });
    const config = loadConfig(barePath);
    expect(config.servers).toHaveLength(1);
    expect(config.profiles).toBeUndefined();
    expect(config.activeProfile).toBeUndefined();
  });

  test('config with profiles and activeProfile loads fine', () => {
    const fullPath = createTestConfig({
      servers: [{ name: 's1', url: 'http://localhost' }],
      profiles: [{ name: 'p1', servers: ['s1'] }],
      activeProfile: 'p1'
    });
    const config = loadConfig(fullPath);
    expect(config.profiles).toHaveLength(1);
    expect(config.activeProfile).toBe('p1');
  });
});
