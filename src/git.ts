import { spawn } from 'node:child_process'

import { default as _semver } from 'semver'

import { existCommand } from './utils'

export interface ResolveGitCommitishOptions {
  cwd?: string
}

export async function resolveGitCommitish(
  commitish = 'HEAD',
  options: ResolveGitCommitishOptions = {}
): Promise<string> {
  const displayCommitish = JSON.stringify(commitish)

  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    let child: ReturnType<typeof spawn>

    try {
      child = spawn('git', ['rev-parse', '--verify', '--end-of-options', `${commitish}^{commit}`], {
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      })
    } catch (error) {
      reject(createGitSpawnError(error, displayCommitish))
      return
    }

    const childStdout = child.stdout
    const childStderr = child.stderr
    if (!childStdout || !childStderr) {
      settled = true
      child.kill()
      reject(new Error(`Git process did not expose output for commitish ${displayCommitish}`))
      return
    }

    childStdout.setEncoding('utf8')
    childStderr.setEncoding('utf8')
    childStdout.on('data', chunk => {
      stdout += chunk
    })
    childStderr.on('data', chunk => {
      stderr += chunk
    })
    child.once('error', error => {
      if (settled) {
        return
      }
      settled = true
      reject(createGitSpawnError(error, displayCommitish))
    })
    child.once('close', (code, signal) => {
      if (settled) {
        return
      }
      settled = true

      if (code !== 0) {
        if (/not a git repository/i.test(stderr)) {
          reject(new Error(`Cannot resolve Git commitish outside a Git repository`))
          return
        }

        const termination = signal ? `signal ${signal}` : `exit code ${code ?? 'unknown'}`
        reject(
          new Error(
            `Git commitish ${displayCommitish} does not resolve to a commit (${termination})`
          )
        )
        return
      }

      const values = stdout.trim().split(/\r?\n/u).filter(Boolean)
      if (values.length !== 1) {
        reject(new Error(`Git returned invalid output for commitish ${displayCommitish}`))
        return
      }

      resolve(values[0])
    })
  })
}

function createGitSpawnError(error: unknown, displayCommitish: string): Error {
  if (isNodeError(error) && error.code === 'ENOENT') {
    return new Error(`Cannot resolve Git commitish ${displayCommitish}: git command not found`)
  }
  const message = error instanceof Error ? error.message : String(error)
  return new Error(`Cannot resolve Git commitish ${displayCommitish}: ${message}`)
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

export async function gitTags({
  semver = false,
  sort = 'creatordate'
}: { semver?: boolean; sort?: 'taggerdate' | 'creatordate' } = {}): Promise<string[]> {
  if (!(await existCommand('git'))) {
    throw new Error('not found git command')
  }

  return new Promise((resolve, reject) => {
    try {
      const child = spawn('git', ['--no-pager', 'tag', '-l', `--sort=${sort}`])
      child.stdout.on('data', data => {
        const tags = parseTags(data.toString().trim())
        resolve(semver ? tags.filter(tag => _semver.valid(tag)) : tags)
      })
    } catch (e) {
      reject(e)
    }
  })
}

function parseTags(tags: string): string[] {
  return tags.split(`\n`).filter(Boolean)
}
