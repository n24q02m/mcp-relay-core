import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock node:fs/promises BEFORE importing config-file.ts
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    writeFile: vi.fn(actual.writeFile)
  }
})

import {
  deleteConfig,
  exportConfig,
  importConfig,
  listConfigs,
  readConfig,
  setConfigPath,
  writeConfig
} from '../../src/storage/config-file.js'

let tempDir: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'mcp-test-'))
  setConfigPath(join(tempDir, 'nested/config.enc'))
  vi.mocked(writeFile).mockClear()
}, 30000)

afterEach(async () => {
  setConfigPath(null)
  await rm(tempDir, { recursive: true, force: true })
}, 30000)

describe('writeConfig + readConfig', () => {
  it('writes and reads a server config', async () => {
    await writeConfig('telegram', { botToken: 'abc123', chatId: '456' })
    const config = await readConfig('telegram')
    expect(config).toEqual({ botToken: 'abc123', chatId: '456' })
  }, 30000)

  it('returns null for non-existent server', async () => {
    const config = await readConfig('nonexistent')
    expect(config).toBeNull()
  })

  it('returns null when no config file exists', async () => {
    // Reset config path to trigger default behavior
    setConfigPath(null)
    const config = await readConfig('anything')
    expect(config).toBeNull()
    // Restore for other tests
    setConfigPath(join(tempDir, 'nested/config.enc'))
  })

  it('throws when config file is corrupt', async () => {
    const configPath = join(tempDir, 'nested/config.enc')
    await mkdir(dirname(configPath), { recursive: true })
    const fs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    await fs.writeFile(configPath, Buffer.from('corrupt-data-shorter-than-12-bytes'))
    await expect(readConfig('any')).rejects.toThrow()
  }, 30000)

  it('handles migration failure when both keys fail', async () => {
    const { encryptData, deriveFileKey } = await import('../../src/storage/encryption.js')
    const { getMachineId, getUsername } = await import('../../src/storage/machine-id.js')
    const [machineId, username] = await Promise.all([getMachineId(), getUsername()])
    const wrongKey = await deriveFileKey(`${machineId}wrong`, username)
    const encrypted = await encryptData(wrongKey, JSON.stringify({ version: 1, servers: {} }))

    const configPath = join(tempDir, 'nested/config.enc')
    await mkdir(dirname(configPath), { recursive: true })
    const fs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    await fs.writeFile(configPath, encrypted)

    await expect(readConfig('any')).rejects.toThrow()
  }, 30000)

  it('auto-migrates legacy config', async () => {
    const { LEGACY_PBKDF2_ITERATIONS, PBKDF2_ITERATIONS, encryptData, decryptData, deriveFileKey } = await import(
      '../../src/storage/encryption.js'
    )
    const { getMachineId, getUsername } = await import('../../src/storage/machine-id.js')
    const [machineId, username] = await Promise.all([getMachineId(), getUsername()])

    const legacyKey = await deriveFileKey(machineId, username, LEGACY_PBKDF2_ITERATIONS)
    const store = { version: 1, servers: { legacy: { key: 'value' } } }
    const encrypted = await encryptData(legacyKey, JSON.stringify(store))

    const configPath = join(tempDir, 'nested/config.enc')
    await mkdir(dirname(configPath), { recursive: true })
    const fs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    await fs.writeFile(configPath, encrypted)

    // Reading should trigger auto-migration
    const config = await readConfig('legacy')
    expect(config).toEqual({ key: 'value' })

    // Verify file is now encrypted with current iterations
    const newData = await fs.readFile(configPath)
    const currentKey = await deriveFileKey(machineId, username, PBKDF2_ITERATIONS)
    const decrypted = await decryptData(currentKey, newData)
    expect(JSON.parse(decrypted)).toEqual(store)

    // Legacy key should no longer decrypt
    await expect(decryptData(legacyKey, newData)).rejects.toThrow()
  }, 60000)
})

describe('writeConfig merging', () => {
  it('does not overwrite other servers sections', async () => {
    await writeConfig('telegram', { botToken: 'tok1' })
    await writeConfig('slack', { webhook: 'https://example.com' })

    const telegram = await readConfig('telegram')
    const slack = await readConfig('slack')
    expect(telegram).toEqual({ botToken: 'tok1' })
    expect(slack).toEqual({ webhook: 'https://example.com' })
  }, 30000)

  it('overwrites same server config on second write', async () => {
    await writeConfig('telegram', { botToken: 'old' })
    await writeConfig('telegram', { botToken: 'new', extra: 'field' })

    const config = await readConfig('telegram')
    expect(config).toEqual({ botToken: 'new', extra: 'field' })
  }, 30000)
})

describe('deleteConfig', () => {
  it('removes a server section', async () => {
    await writeConfig('telegram', { botToken: 'tok' })
    await writeConfig('slack', { webhook: 'url' })

    await deleteConfig('telegram')

    expect(await readConfig('telegram')).toBeNull()
    expect(await readConfig('slack')).toEqual({ webhook: 'url' })
  }, 30000)

  it('deletes file when last server removed', async () => {
    await writeConfig('telegram', { botToken: 'tok' })
    const configPath = join(tempDir, 'nested/config.enc')
    expect(existsSync(configPath)).toBe(true)

    await deleteConfig('telegram')
    expect(existsSync(configPath)).toBe(false)
  }, 30000)

  it('skips unlink if file does not exist', async () => {
    // Manually delete the file before calling deleteConfig
    const configPath = join(tempDir, 'nested/config.enc')
    await writeConfig('telegram', { botToken: 'tok' })
    expect(existsSync(configPath)).toBe(true)

    // This is the part that was missing - making sure store is empty but file is already gone
    const fs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    await fs.unlink(configPath)
    expect(existsSync(configPath)).toBe(false)

    await deleteConfig('telegram')
    expect(existsSync(configPath)).toBe(false)
  }, 30000)

  it('no-op for non-existent server', async () => {
    await writeConfig('telegram', { botToken: 'tok' })
    await deleteConfig('nonexistent')
    expect(await readConfig('telegram')).toEqual({ botToken: 'tok' })
  }, 30000)
})

describe('listConfigs', () => {
  it('returns empty array when no config', async () => {
    expect(await listConfigs()).toEqual([])
  })

  it('returns list of server names', async () => {
    await writeConfig('telegram', { a: '1' })
    await writeConfig('slack', { b: '2' })
    await writeConfig('discord', { c: '3' })

    const names = await listConfigs()
    expect(names.sort()).toEqual(['discord', 'slack', 'telegram'])
  }, 30000)
})

describe('exportConfig + importConfig', () => {
  it('roundtrip with passphrase', async () => {
    await writeConfig('telegram', { botToken: 'abc' })
    await writeConfig('slack', { webhook: 'url' })

    const exported = await exportConfig('my-secret-passphrase')
    expect(exported).toBeInstanceOf(Buffer)

    // Clear local config
    await deleteConfig('telegram')
    await deleteConfig('slack')
    expect(await listConfigs()).toEqual([])

    // Import back
    await importConfig('my-secret-passphrase', exported)
    expect(await readConfig('telegram')).toEqual({ botToken: 'abc' })
    expect(await readConfig('slack')).toEqual({ webhook: 'url' })
  }, 60000)

  it('wrong passphrase fails to import', async () => {
    await writeConfig('telegram', { botToken: 'abc' })
    const exported = await exportConfig('correct-pass')

    await expect(importConfig('wrong-pass', exported)).rejects.toThrow()
  }, 30000)

  it('import merges into existing config', async () => {
    await writeConfig('local-server', { key: 'local-val' })

    // Create export data from a separate config
    await writeConfig('remote-server', { key: 'remote-val' })
    const exported = await exportConfig('pass')

    // Remove remote, keep local
    await deleteConfig('remote-server')
    expect(await listConfigs()).toEqual(['local-server'])

    // Import should merge
    await importConfig('pass', exported)
    expect(await readConfig('local-server')).toEqual({ key: 'local-val' })
    expect(await readConfig('remote-server')).toEqual({ key: 'remote-val' })
  }, 60000)

  it('importConfig handles decryption failure', async () => {
    const { encryptData, derivePassphraseKey } = await import('../../src/storage/encryption.js')
    const wrongKey = await derivePassphraseKey('wrong-pass')
    const encrypted = await encryptData(wrongKey, JSON.stringify({ version: 1, servers: {} }))
    await expect(importConfig('correct-pass', encrypted)).rejects.toThrow()
  }, 30000)
})

describe('withRetry', () => {
  it('eventually fails after exhausting retries', async () => {
    const error = new Error('EBUSY')
    Object.defineProperty(error, 'code', { value: 'EBUSY' })

    vi.mocked(writeFile).mockRejectedValue(error)

    await expect(writeConfig('test-retry-fail', { key: 'val' })).rejects.toThrow('EBUSY')
    expect(writeFile).toHaveBeenCalledTimes(3)
  }, 30000)

  it('retries and succeeds if EBUSY happens then goes away', async () => {
    const error = new Error('EBUSY')
    Object.defineProperty(error, 'code', { value: 'EBUSY' })

    vi.mocked(writeFile)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(undefined as never)

    await writeConfig('test-retry-success', { key: 'val' })
    expect(writeFile).toHaveBeenCalledTimes(3)
  }, 30000)
})
