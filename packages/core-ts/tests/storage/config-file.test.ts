import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteConfig,
  exportConfig,
  importConfig,
  listConfigs,
  readConfig,
  setConfigPath,
  writeConfig
} from '../../src/storage/config-file.js'
import {
  decryptData,
  deriveFileKey,
  encryptData,
  LEGACY_PBKDF2_ITERATIONS,
  PBKDF2_ITERATIONS,
  V1_LEGACY_PBKDF2_ITERATIONS
} from '../../src/storage/encryption.js'
import { getMachineId, getUsername } from '../../src/storage/machine-id.js'

vi.mock('../../src/storage/machine-id.js', () => ({
  getMachineId: vi.fn().mockResolvedValue('test-machine'),
  getUsername: vi.fn().mockResolvedValue('test-user')
}))

describe('config-file storage', () => {
  const tmpPath = './test-config.enc'

  beforeEach(() => {
    if (existsSync(tmpPath)) {
      require('node:fs').unlinkSync(tmpPath)
    }
    setConfigPath(tmpPath)
  })

  it('writes and reads a server config', async () => {
    await writeConfig('telegram', { token: 'abc', chat: '123' })
    const config = await readConfig('telegram')
    expect(config).toEqual({ token: 'abc', chat: '123' })
  })

  it('does not overwrite other servers sections', async () => {
    await writeConfig('server1', { k: 'v1' })
    await writeConfig('server2', { k: 'v2' })

    expect(await readConfig('server1')).toEqual({ k: 'v1' })
    expect(await readConfig('server2')).toEqual({ k: 'v2' })
  })

  it('overwrites same server config on second write', async () => {
    await writeConfig('s', { a: '1' })
    await writeConfig('s', { a: '2', b: '3' })
    expect(await readConfig('s')).toEqual({ a: '2', b: '3' })
  })

  it('removes a server section', async () => {
    await writeConfig('s1', { x: '1' })
    await writeConfig('s2', { x: '2' })
    await deleteConfig('s1')

    expect(await readConfig('s1')).toBeNull()
    expect(await readConfig('s2')).toEqual({ x: '2' })
  })

  it('deletes file when last server removed', async () => {
    await writeConfig('s', { x: '1' })
    await deleteConfig('s')
    expect(existsSync(tmpPath)).toBe(false)
  })

  it('no-op for non-existent server', async () => {
    await writeConfig('s', { x: '1' })
    await deleteConfig('nonexistent')
    expect(await readConfig('s')).toEqual({ x: '1' })
  })

  it('returns list of server names', async () => {
    await writeConfig('a', { x: '1' })
    await writeConfig('b', { x: '2' })
    const list = await listConfigs()
    expect(list.sort()).toEqual(['a', 'b'])
  })

  it('roundtrip with passphrase', async () => {
    await writeConfig('s', { x: '1' })
    const exported = await exportConfig('secret')
    expect(exported).toBeInstanceOf(Buffer)

    await deleteConfig('s')
    expect(await readConfig('s')).toBeNull()

    await importConfig('secret', exported)
    expect(await readConfig('s')).toEqual({ x: '1' })
  }, 15000)

  it('wrong passphrase fails to import', async () => {
    await writeConfig('s', { x: '1' })
    const exported = await exportConfig('correct')
    await expect(importConfig('wrong', exported)).rejects.toThrow()
  }, 15000)

  it('import merges into existing config', async () => {
    await writeConfig('local', { k: 'l' })

    // Create a separate export
    const otherPath = './test-other.enc'
    setConfigPath(otherPath)
    await writeConfig('remote', { k: 'r' })
    const exported = await exportConfig('pass')
    if (existsSync(otherPath)) require('node:fs').unlinkSync(otherPath)

    setConfigPath(tmpPath)
    await importConfig('pass', exported)

    expect(await readConfig('local')).toEqual({ k: 'l' })
    expect(await readConfig('remote')).toEqual({ k: 'r' })
  }, 20000)

  it('auto-migrates legacy configs', async () => {
    const machineId = await getMachineId()
    const username = await getUsername()

    for (const iterations of [LEGACY_PBKDF2_ITERATIONS, V1_LEGACY_PBKDF2_ITERATIONS]) {
      const legacyKey = await deriveFileKey(machineId, username, iterations)
      const store = { version: 1, servers: { [`legacy-${iterations}`]: { key: 'val' } } }
      const encrypted = await encryptData(legacyKey, JSON.stringify(store))

      writeFileSync(tmpPath, encrypted)

      // Read should trigger migration
      const config = await readConfig(`legacy-${iterations}`)
      expect(config).toEqual({ key: 'val' })

      // Verify file is now encrypted with current iterations
      const newData = readFileSync(tmpPath)
      const currentKey = await deriveFileKey(machineId, username, PBKDF2_ITERATIONS)
      const decrypted = await decryptData(currentKey, newData)
      expect(JSON.parse(decrypted).servers[`legacy-${iterations}`]).toEqual({ key: 'val' })
    }
  }, 30000)
})
