import { spawn } from 'node:child_process'

export function existCommand(command: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      const child = spawn('which', [command])
      if (child.exitCode !== null) {
        resolve(child.exitCode === 0)
      } else {
        child.on('exit', code => resolve(code === 0))
      }
    } catch (e) {
      reject(e)
    }
  })
}
