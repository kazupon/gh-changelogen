import { spawn } from 'node:child_process'
import { existCommand, isFunction, normalizeGithubRelease } from './utils'

import type { GitHubRelease, Fetcher } from './types'

async function fetcherDefault(tag: string): Promise<GitHubRelease> {
  if (!(await existCommand('gh'))) {
    throw new Error('not found gh command')
  }

  return new Promise((resolve, reject) => {
    try {
      const fields = [
        'assets',
        'author',
        'body',
        'createdAt',
        'id',
        'isDraft',
        'isPrerelease',
        'name',
        'publishedAt',
        'tagName',
        'tarballUrl',
        'targetCommitish',
        'uploadUrl',
        'url',
        'zipballUrl'
      ]
      const child = spawn('gh', ['release', 'view', tag, '--json', fields.join(',')], {
        env: { ...process.env }
      })
      child.stdout.on('data', data => {
        resolve(normalizeGithubRelease(JSON.parse(data)))
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
