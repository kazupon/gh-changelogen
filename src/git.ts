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

export async function gitCurrentTag(): Promise<string> {
  if (!(await existCommand('git'))) {
    throw new Error('not found git command')
  }

  return new Promise((resolve, reject) => {
    try {
      const child = spawn('git', ['tag', '--points-at', 'HEAD'])
      child.stdout.on('data', data => {
        resolve(data.toString().trim())
      })
    } catch (e) {
      reject(e)
    }
  })
}

export async function gitLastTag(): Promise<string> {
  if (!(await existCommand('git'))) {
    throw new Error('not found git command')
  }

  return new Promise((resolve, reject) => {
    try {
      const child = spawn('git', ['describe', '--abbrev=0', '--tags'])
      child.stdout.on('data', data => {
        resolve(data.toString().trim())
      })
    } catch (e) {
      reject(e)
    }
  })
}

export async function gitCurrentBranch(): Promise<string> {
  if (!(await existCommand('git'))) {
    throw new Error('not found git command')
  }

  return new Promise((resolve, reject) => {
    try {
      const child = spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
      child.stdout.on('data', data => {
        resolve(data.toString().trim())
      })
    } catch (e) {
      reject(e)
    }
  })
}

export async function gitFirstCommit(): Promise<string> {
  if (!(await existCommand('git'))) {
    throw new Error('not found git command')
  }

  return new Promise((resolve, reject) => {
    try {
      const child = spawn('git', ['rev-list', '--max-parents=0', 'HEAD'])
      child.stdout.on('data', data => {
        resolve(data.toString().trim())
      })
    } catch (e) {
      reject(e)
    }
  })
}
