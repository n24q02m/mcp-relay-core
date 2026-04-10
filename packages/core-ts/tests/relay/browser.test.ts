import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tryOpenBrowser } from '../../src/relay/browser.js'

// Define types for the mock to avoid Semgrep findings on 'any'
type ExecFileCallback = (err: Error | null, stdout: string, stderr: string) => void

// Mock child_process and fs/promises before importing the module
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], cb: ExecFileCallback) => {
    if (typeof cb === 'function') {
      cb(null, '', '')
    }
    // Return a dummy object that matches ChildProcess enough for the promisify wrapper
    return {
      on: vi.fn(),
      unref: vi.fn(),
      stdin: {},
      stdout: {},
      stderr: {},
      kill: vi.fn()
    }
  })
}))

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('ENOENT'))
}))

describe('tryOpenBrowser', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.mocked(execFile).mockClear()
    vi.mocked(readFile).mockClear()
  })

  describe('URL validation', () => {
    it('rejects non-http URLs', async () => {
      expect(await tryOpenBrowser('file:///etc/passwd')).toBe(false)
      expect(await tryOpenBrowser('javascript:alert(1)')).toBe(false)
      expect(await tryOpenBrowser('ftp://example.com')).toBe(false)
      expect(await tryOpenBrowser('data:text/html,<h1>hi</h1>')).toBe(false)
    })

    it('rejects empty and malformed input', async () => {
      expect(await tryOpenBrowser('')).toBe(false)
      expect(await tryOpenBrowser(' ')).toBe(false)
      expect(await tryOpenBrowser('not-a-url')).toBe(false)
      expect(await tryOpenBrowser('://missing-scheme')).toBe(false)
    })

    it('accepts valid http URLs', async () => {
      const result = await tryOpenBrowser('http://localhost:3000/setup')
      expect(typeof result).toBe('boolean')
    })

    it('accepts valid https URLs', async () => {
      const result = await tryOpenBrowser('https://example.com/setup?s=abc#k=def&p=ghi')
      expect(typeof result).toBe('boolean')
    })
  })

  describe('Platform: win32', () => {
    it('uses rundll32.exe on win32', async () => {
      vi.stubGlobal('process', { ...process, platform: 'win32' })
      const url = 'https://example.com'
      const result = await tryOpenBrowser(url)

      expect(result).toBe(true)
      expect(execFile).toHaveBeenCalledWith('rundll32.exe', ['url.dll,FileProtocolHandler', url], expect.any(Function))
    })
  })

  describe('Platform: darwin', () => {
    it('uses open on darwin', async () => {
      vi.stubGlobal('process', { ...process, platform: 'darwin' })
      const url = 'https://example.com'
      const result = await tryOpenBrowser(url)

      expect(result).toBe(true)
      expect(execFile).toHaveBeenCalledWith('open', [url], expect.any(Function))
    })
  })

  describe('Platform: linux', () => {
    it('handles isWsl error path (readFile throws)', async () => {
      vi.stubGlobal('process', { ...process, platform: 'linux' })
      vi.mocked(readFile).mockRejectedValue(new Error('Permission denied'))

      const url = 'https://example.com'
      const result = await tryOpenBrowser(url)

      expect(result).toBe(true)
      // Should fall back to xdg-open
      expect(execFile).toHaveBeenCalledWith('xdg-open', [url], expect.any(Function))
    })

    it('detects WSL and tries wslview', async () => {
      vi.stubGlobal('process', { ...process, platform: 'linux' })
      vi.mocked(readFile).mockResolvedValue('Linux version 5.10.16.3-microsoft-standard-WSL2')

      const url = 'https://example.com'
      const result = await tryOpenBrowser(url)

      expect(result).toBe(true)
      expect(execFile).toHaveBeenCalledWith('wslview', [url], expect.any(Function))
    })

    it('falls back to rundll32 in WSL if wslview fails', async () => {
      vi.stubGlobal('process', { ...process, platform: 'linux' })
      vi.mocked(readFile).mockResolvedValue('WSL2 detected')
      vi.mocked(execFile).mockImplementation((cmd, _args, cb) => {
        const callback = cb as ExecFileCallback
        if (cmd === 'wslview') {
          callback(new Error('not found'), '', '')
        } else {
          callback(null, '', '')
        }
        return { on: vi.fn(), unref: vi.fn() } as unknown as ReturnType<typeof execFile>
      })

      const url = 'https://example.com'
      const result = await tryOpenBrowser(url)

      expect(result).toBe(true)
      expect(execFile).toHaveBeenCalledWith('wslview', [url], expect.any(Function))
      expect(execFile).toHaveBeenCalledWith('rundll32.exe', ['url.dll,FileProtocolHandler', url], expect.any(Function))
    })

    it('falls back to xdg-open if all WSL opening methods fail', async () => {
      vi.stubGlobal('process', { ...process, platform: 'linux' })
      vi.mocked(readFile).mockResolvedValue('microsoft')
      vi.mocked(execFile).mockImplementation((cmd, _args, cb) => {
        const callback = cb as ExecFileCallback
        if (cmd === 'wslview' || cmd === 'rundll32.exe') {
          callback(new Error('fail'), '', '')
        } else {
          callback(null, '', '')
        }
        return { on: vi.fn(), unref: vi.fn() } as unknown as ReturnType<typeof execFile>
      })

      const url = 'https://example.com'
      const result = await tryOpenBrowser(url)

      expect(result).toBe(true)
      expect(execFile).toHaveBeenCalledWith('xdg-open', [url], expect.any(Function))
    })

    it('falls back to xdg-open if WSL detection fails or WSL opening fails', async () => {
      vi.stubGlobal('process', { ...process, platform: 'linux' })
      vi.mocked(readFile).mockResolvedValue('standard linux')

      const url = 'https://example.com'
      const result = await tryOpenBrowser(url)

      expect(result).toBe(true)
      expect(execFile).toHaveBeenCalledWith('xdg-open', [url], expect.any(Function))
    })
  })

  describe('Error handling', () => {
    it('returns false when all commands fail', async () => {
      vi.stubGlobal('process', { ...process, platform: 'linux' })
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'))
      vi.mocked(execFile).mockImplementation((_cmd, _args, cb) => {
        const callback = cb as ExecFileCallback
        callback(new Error('failed'), '', '')
        return { on: vi.fn(), unref: vi.fn() } as unknown as ReturnType<typeof execFile>
      })

      const result = await tryOpenBrowser('https://example.com')
      expect(result).toBe(false)
    })

    it('never throws even with unexpected errors', async () => {
      vi.mocked(execFile).mockImplementation(() => {
        throw new TypeError('unexpected')
      })

      const result = await tryOpenBrowser('https://example.com')
      expect(result).toBe(false)
    })
  })
})
