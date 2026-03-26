import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { hostname, networkInterfaces, userInfo } from 'node:os'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

let cachedMachineId: string | undefined
let cachedUsername: string | undefined

export async function getMachineId(): Promise<string> {
  if (cachedMachineId !== undefined) return cachedMachineId

  let machineId: string
  try {
    if (process.platform === 'linux') {
      machineId = (await readFile('/etc/machine-id', 'utf-8')).trim()
      cachedMachineId = machineId
      return machineId
    }
    if (process.platform === 'darwin') {
      const { stdout } = await execFileAsync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'])
      const match = stdout.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/)
      if (match) {
        machineId = match[1]
        cachedMachineId = machineId
        return machineId
      }
    }
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('reg', [
        'query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid',
      ])
      const match = stdout.match(/MachineGuid\s+REG_SZ\s+(\S+)/)
      if (match) {
        machineId = match[1]
        cachedMachineId = machineId
        return machineId
      }
    }
  } catch {
    /* fallback below */
  }

  // Fallback: hostname + first MAC address
  const nics = networkInterfaces()
  const mac = Object.values(nics)
    .flat()
    .find((n) => n && !n.internal && n.mac !== '00:00:00:00:00:00')?.mac
  machineId = `${hostname()}-${mac ?? 'unknown'}`
  cachedMachineId = machineId
  return machineId
}

export function getUsername(): string {
  if (cachedUsername !== undefined) return cachedUsername
  let username: string
  try {
    username = userInfo().username
  } catch {
    username = process.env.USER ?? process.env.USERNAME ?? 'unknown'
  }
  cachedUsername = username
  return username
}
