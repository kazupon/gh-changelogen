import { spawn } from 'node:child_process'

import type { GitHubRelease, GitHubUser } from './types'

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

// eslint-disable-next-line @typescript-eslint/ban-types
export function isFunction(value: unknown): value is Function {
  return typeof value === 'function'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeGithubRelease(org: any): GitHubRelease {
  const author = org.author || ({ id: '', login: '' } as GitHubUser)

  const release: GitHubRelease = {
    assets: [],
    author,
    body: org.body,
    created_at: org.createdAt,
    id: org.id,
    draft: org.isDraft,
    prelease: org.isPrerelease,
    name: org.name,
    published_at: org.publishedAt,
    tag_name: org.tagName,
    tarball_url: org.tarballUrl,
    target_commitish: org.targetCommitish,
    upload_url: org.uploadUrl,
    url: org.url,
    zipball_url: org.zipballUrl
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  release.assets = (org.assets || []).map((asset: any) => {
    // TODO: other fields
    return { id: asset.id }
  })

  return release
}
