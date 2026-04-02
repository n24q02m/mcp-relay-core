import { existsSync } from 'node:fs'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONFIG_PATH,
  deleteConfig,
  exportConfig,
  importConfig,
  listConfigs,
  readConfig,
  setConfigPath,
  writeConfig
} from '../../src/storage/config-file.js'
import { decryptData, deriveFileKey, encryptData } from '../../src/storage/encryption.js'
import { getMachineId, getUsername } from '../../src/storage/machine-id.js'

describe('config-file', () => {
  it('writes and reads a server config', async () => {
    const configPath = join(dirname(DEFAULT_CONFIG_PATH), 'test-config.enc')
    setConfigPath(configPath)

    await writeConfig('server1', { key1: 'val1' })
    const config = await readConfig('server1')
    expect(config).toEqual({ key1: 'val1' })

    if (existsSync(configPath)) {
      await unlink(configPath)
    }
    setConfigPath(null)
  })

  it('returns null for non-existent server', async () => {
    const config = await readConfig('non-existent')
    expect(config).toBeNull()
  })

  it('returns null when no config file exists', async () => {
    const configPath = join(dirname(DEFAULT_CONFIG_PATH), 'non-existent.enc')
    setConfigPath(configPath)
    const config = await readConfig('any')
    expect(config).toBeNull()
    setConfigPath(null)
  })

  it('does not overwrite other servers sections', async () => {
    const configPath = join(dirname(DEFAULT_CONFIG_PATH), 'multi-test.enc')
    setConfigPath(configPath)

    await writeConfig('srv1', { a: '1' })
    await writeConfig('srv2', { b: '2' })

    expect(await readConfig('srv1')).toEqual({ a: '1' })
    expect(await readConfig('srv2')).toEqual({ b: '2' })

    if (existsSync(configPath)) {
      await unlink(configPath)
    }
    setConfigPath(null)
  })

  it('overwrites same server config on second write', async () => {
    const configPath = join(dirname(DEFAULT_CONFIG_PATH), 'overwrite-test.enc')
    setConfigPath(configPath)

    await writeConfig('srv', { v: '1' })
    await writeConfig('srv', { v: '2' })
    expect(await readConfig('srv')).toEqual({ v: '2' })

    if (existsSync(configPath)) {
      await unlink(configPath)
    }
    setConfigPath(null)
  })

  it('removes a server section', async () => {
    const configPath = join(dirname(DEFAULT_CONFIG_PATH), 'remove-test.enc')
    setConfigPath(configPath)

    await writeConfig('srv1', { a: '1' })
    await writeConfig('srv2', { b: '2' })
    await deleteConfig('srv1')

    expect(await readConfig('srv1')).toBeNull()
    expect(await readConfig('srv2')).toEqual({ b: '2' })

    if (existsSync(configPath)) {
      await unlink(configPath)
    }
    setConfigPath(null)
  })

  it('deletes file when last server removed', async () => {
    const configPath = join(dirname(DEFAULT_CONFIG_PATH), 'empty-test.enc')
    setConfigPath(configPath)

    await writeConfig('srv', { a: '1' })
    expect(existsSync(configPath)).toBe(true)

    await deleteConfig('srv')
    expect(existsSync(configPath)).toBe(false)

    setConfigPath(null)
  })

  it('no-op for non-existent server', async () => {
    const configPath = join(dirname(DEFAULT_CONFIG_PATH), 'noop-test.enc')
    setConfigPath(configPath)

    await writeConfig('srv', { a: '1' })
    await deleteConfig('other')
    expect(await readConfig('srv')).toEqual({ a: '1' })

    if (existsSync(configPath)) {
      await unlink(configPath)
    }
    setConfigPath(null)
  })

  it('returns empty array when no config', async () => {
    const configPath = join(dirname(DEFAULT_CONFIG_PATH), 'list-empty.enc')
    setConfigPath(configPath)
    expect(await listConfigs()).toEqual([])
    setConfigPath(null)
  })

  it('returns list of server names', async () => {
    const configPath = join(dirname(DEFAULT_CONFIG_PATH), 'list-test.enc')
    setConfigPath(configPath)

    await writeConfig('a', {})
    await writeConfig('c', {})
    await writeConfig('b', {})

    const list = await listConfigs()
    expect(list).toContain('a')
    expect(list).toContain('b')
    expect(list).toContain('c')
    expect(list.length).toBe(3)

    if (existsSync(configPath)) {
      await unlink(configPath)
    }
    setConfigPath(null)
  })
})

describe('exportConfig + importConfig', () => {
  it('roundtrip with passphrase', async () => {
    const configPath = join(dirname(DEFAULT_CONFIG_PATH), 'export-test.enc')
    setConfigPath(configPath)

    await writeConfig('telegram', { botToken: 'abc' })
    await writeConfig('slack', { webhook: 'url' })

    const exportData = await exportConfig('secret-passphrase')
    expect(exportData).toBeInstanceOf(Buffer)

    // Clear local config
    await deleteConfig('telegram')
    await deleteConfig('slack')
    expect(await listConfigs()).toEqual([])

    // Import
    await importConfig('secret-passphrase', exportData)
    expect(await readConfig('telegram')).toEqual({ botToken: 'abc' })
    expect(await readConfig('slack')).toEqual({ webhook: 'url' })

    if (existsSync(configPath)) {
      await unlink(configPath)
    }
    setConfigPath(null)
  })

  it('wrong passphrase fails to import', async () => {
    await writeConfig('t', { k: 'v' })
    const data = await exportConfig('correct')
    await expect(importConfig('wrong', data)).rejects.toThrow()
    await deleteConfig('t')
  })

  it('import merges into existing config', async () => {
    const configPath = join(dirname(DEFAULT_CONFIG_PATH), 'merge-test.enc')
    setConfigPath(configPath)

    await writeConfig('existing', { k: 'v1' })
    const exportData = await exportConfig('pass')

    await writeConfig('existing', { k: 'v2' })
    await writeConfig('new', { k: 'v3' })

    await importConfig('pass', exportData)

    expect(await readConfig('existing')).toEqual({ k: 'v1' })
    expect(await readConfig('new')).toEqual({ k: 'v3' })

    if (existsSync(configPath)) {
      await unlink(configPath)
    }
    setConfigPath(null)
  })
})

describe('migration', () => {
  it('automatically migrates legacy 100k iteration config to 600k', async () => {
    const configPath = join(dirname(DEFAULT_CONFIG_PATH), 'migration-test.enc')
    setConfigPath(configPath)

    const legacyIterations = 100_000
    const [machineId, username] = await Promise.all([getMachineId(), getUsername()])
    const legacyKey = await deriveFileKey(machineId, username, legacyIterations)

    const store = { version: 1, servers: { 'legacy-srv': { key: 'val' } } }
    const encrypted = await encryptData(legacyKey, JSON.stringify(store))
    await writeFile(configPath, encrypted)

    // First load should work due to fallback, and it should trigger migration
    const readStore = await readConfig('legacy-srv')
    expect(readStore).toEqual({ key: 'val' })

    // Verify file was re-encrypted with new iterations (should NOT be decryptable with legacy key)
    const newData = await readFile(configPath)
    await expect(decryptData(legacyKey, newData)).rejects.toThrow()

    // Should be decryptable with new default iterations
    const newKey = await deriveFileKey(machineId, username)
    const decryptedJson = await decryptData(newKey, newData)
    expect(JSON.parse(decryptedJson)).toEqual(store)

    if (existsSync(configPath)) {
      await unlink(configPath)
    }
    setConfigPath(null)
  })
})
