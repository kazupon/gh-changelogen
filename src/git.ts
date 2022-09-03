import { spawn } from 'node:child_process'
import { default as _semver } from 'semver'
import { existCommand } from './utils'

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
