import { spawn } from 'node:child_process'
import { existCommand, isFunction } from './utils'

import type { GitHubRelease, Fetcher } from './types'

async function fetcherDefault(tag: string): Promise<GitHubRelease> {
  if (!(await existCommand('gh'))) {
    throw new Error('not found gh command')
  }

  return new Promise((resolve, reject) => {
    try {
      const child = spawn('gh', ['release', 'view', tag, '--json', 'tagName,name,url,publishedAt,body'], {
        env: { ...process.env }
      })
      child.stdout.on('data', data => {
        resolve(JSON.parse(data) as GitHubRelease)
      })
    } catch (e) {
      reject(e)
    }
  })
}

export async function fetchGithubRelease(tag: string, fetcher: Fetcher = fetcherDefault): Promise<GitHubRelease> {
  if (!isFunction(fetcher)) {
    throw new Error('fetcher is not a function')
  }
  return fetcher(tag)
}
