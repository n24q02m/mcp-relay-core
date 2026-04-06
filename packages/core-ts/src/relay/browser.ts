/**
 * Cross-platform browser opening with WSL detection.
 */

import { exec } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

async function isWsl(): Promise<boolean> {
  try {
    const version = await readFile('/proc/version', 'utf-8')
    const lower = version.toLowerCase()
    return lower.includes('microsoft') || lower.includes('wsl')
  } catch {
    return false
  }
}

async function openInWsl(url: string): Promise<boolean> {
  // Try wslview first (from wslu package, commonly available)
  try {
    await execAsync(`wslview ${JSON.stringify(url)}`)
    return true
  } catch {
    /* fall through */
  }

  // Fallback to cmd.exe /c start
  try {
    const escapedUrl = url.replace(/&/g, '^&')
    await execAsync(`cmd.exe /c start ${JSON.stringify(escapedUrl)}`)
    return true
  } catch {
    /* fall through */
  }

  return false
}

/**
 * Try to open URL in default browser. Returns true if likely succeeded.
 *
 * Detection order:
 * 1. win32: `start` command
 * 2. darwin: `open` command
 * 3. linux: check WSL then `xdg-open`
 *
 * Never throws. Returns false on failure.
 */
export async function tryOpenBrowser(url: string): Promise<boolean> {
  try {
    const platform = process.platform
    const quotedUrl = JSON.stringify(url)

    if (platform === 'win32') {
      await execAsync(`start "" ${quotedUrl}`)
      return true
    }

    if (platform === 'darwin') {
      await execAsync(`open ${quotedUrl}`)
      return true
    }

    // linux
    if (await isWsl()) {
      const result = await openInWsl(url)
      if (result) return true
      // Fall through to xdg-open
    }

    await execAsync(`xdg-open ${quotedUrl}`)
    return true
  } catch {
    return false
  }
}
