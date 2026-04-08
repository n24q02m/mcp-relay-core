import * as child_process from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMachineId } from '../../src/storage/machine-id.js'

vi.mock('node:fs/promises')
vi.mock('node:child_process')
vi.mock('node:os')

// Mock promisify to return the mock execFile directly
vi.mock('node:util', async () => {
  const actual = await vi.importActual('node:util')
  return {
    ...actual,
    promisify: (fn: unknown) => fn
  }
})

describe('getMachineId unit tests', () => {
  const originalPlatform = process.platform

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(os.hostname).mockReturnValue('test-host')
    vi.mocked(os.networkInterfaces).mockReturnValue({
      eth0: [{ mac: '00:11:22:33:44:55', internal: false } as os.NetworkInterfaceInfo]
    })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('linux: reads /etc/machine-id', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    vi.mocked(fs.readFile).mockResolvedValue('linux-mid\n')

    const id = await getMachineId()
    expect(id).toBe('linux-mid')
    expect(fs.readFile).toHaveBeenCalledWith('/etc/machine-id', 'utf-8')
  })

  it('darwin: uses ioreg', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    vi.mocked(child_process.execFile).mockResolvedValue({
      stdout: '"IOPlatformUUID" = "darwin-uuid"',
      stderr: ''
      // biome-ignore lint/suspicious/noExplicitAny: mock
    } as any)

    const id = await getMachineId()
    expect(id).toBe('darwin-uuid')
  })

  it('win32: uses reg query', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    vi.mocked(child_process.execFile).mockResolvedValue({
      stdout: 'MachineGuid    REG_SZ    windows-guid',
      stderr: ''
      // biome-ignore lint/suspicious/noExplicitAny: mock
    } as any)

    const id = await getMachineId()
    expect(id).toBe('windows-guid')
  })

  it('fallback: uses hostname and MAC if platform-specific fails', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'))

    const id = await getMachineId()
    expect(id).toBe('test-host-00:11:22:33:44:55')
  })

  it('fallback: uses hostname and MAC if platform is unknown', async () => {
    Object.defineProperty(process, 'platform', { value: 'freebsd' })

    const id = await getMachineId()
    expect(id).toBe('test-host-00:11:22:33:44:55')
  })
})
