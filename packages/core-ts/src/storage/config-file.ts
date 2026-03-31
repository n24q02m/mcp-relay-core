import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import envPaths from 'env-paths'
import { decryptData, deriveFileKey, derivePassphraseKey, encryptData } from './encryption.js'
import { getMachineId, getUsername } from './machine-id.js'

const paths = envPaths('mcp', { suffix: '' })
const DEFAULT_CONFIG_PATH = join(paths.config, 'config.enc')

interface ConfigStore {
  version: 1
  servers: Record<string, Record<string, string>>
}

// Allow overriding config path for testing
let configPathOverride: string | null = null

export function setConfigPath(path: string | null): void {
  configPathOverride = path
}

function getConfigPath(): string {
  return configPathOverride ?? DEFAULT_CONFIG_PATH
}

const MAX_RETRIES = 3
const BASE_DELAY_MS = 100

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const isLocked = err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'EBUSY'
      if (!isLocked || attempt === MAX_RETRIES - 1) throw err
      await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt))
    }
  }
  throw new Error('Unreachable')
}

async function getKey(): Promise<CryptoKey> {
  const [machineId, username] = await Promise.all([getMachineId(), getUsername()])
  return deriveFileKey(machineId, username)
}
async function loadStore(): Promise<ConfigStore> {
  const configPath = getConfigPath()
  try {
    const data = await readFile(configPath)
    const key = await getKey()
    const json = await decryptData(key, data)
    return JSON.parse(json) as ConfigStore
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: 1, servers: {} }
    }
    throw err
  }
}

async function saveStore(store: ConfigStore): Promise<void> {
  const configPath = getConfigPath()
  const dir = dirname(configPath)
  await mkdir(dir, { recursive: true })
  const key = await getKey()
  const encrypted = await encryptData(key, JSON.stringify(store))
  await withRetry(() => writeFile(configPath, encrypted))
}

export async function readConfig(serverName: string): Promise<Record<string, string> | null> {
  const store = await loadStore()
  return store.servers[serverName] ?? null
}

export async function writeConfig(serverName: string, config: Record<string, string>): Promise<void> {
  const store = await loadStore()
  store.servers[serverName] = config
  await saveStore(store)
}
export async function deleteConfig(serverName: string): Promise<void> {
  const store = await loadStore()
  delete store.servers[serverName]

  const configPath = getConfigPath()
  if (Object.keys(store.servers).length === 0) {
    try {
      await unlink(configPath)
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        // Ignore
      } else {
        throw err
      }
    }
  } else {
    await saveStore(store)
  }
}

export async function listConfigs(): Promise<string[]> {
  const store = await loadStore()
  return Object.keys(store.servers)
}

export async function exportConfig(passphrase: string): Promise<Buffer> {
  const store = await loadStore()
  const key = await derivePassphraseKey(passphrase)
  return encryptData(key, JSON.stringify(store))
}

export async function importConfig(passphrase: string, data: Buffer): Promise<void> {
  const key = await derivePassphraseKey(passphrase)
  const json = await decryptData(key, data)
  const imported = JSON.parse(json) as ConfigStore

  const store = await loadStore()
  // Merge imported servers into local config
  for (const [name, config] of Object.entries(imported.servers)) {
    store.servers[name] = config
  }
  await saveStore(store)
}
