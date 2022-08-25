import { vi } from 'vitest'
import { spawn } from 'node:child_process'
import { gitTags } from '../../git'
import { existCommand } from '../../utils'

import type { ChildProcess } from 'node:child_process'

vi.mock('../../utils', () => {
  return {
    existCommand: vi.fn().mockImplementation(() => Promise.resolve(true))
  }
})

vi.mock('node:child_process', () => {
  return {
    spawn: vi.fn()
  }
})

describe('gitTags', () => {
  test('git tag format', async () => {
    const tags = ['0.0.1', '0.0.2.12344', 'v0.1.0']

    // mocking
    const on = vi.fn().mockImplementationOnce((event: string, cb: Function) => {
      if (event === 'data') {
        cb(tags.join('\n'))
      }
    })
    vi.mocked(spawn).mockImplementationOnce(() => {
      return { exitCode: null, stdout: { on } } as unknown as ChildProcess
    })

    // assertions
    expect(await gitTags()).toEqual(tags)
  })

  test('empty string', async () => {
    // mocking
    const on = vi.fn().mockImplementationOnce((event: string, cb: Function) => {
      if (event === 'data') {
        cb('')
      }
    })
    vi.mocked(spawn).mockImplementationOnce(() => {
      return { exitCode: null, stdout: { on } } as unknown as ChildProcess
    })

    // assertions
    expect(await gitTags()).toEqual([])
  })

  test('not git tag format', async () => {
    const tags = ['0.0.1', '0.0.2.12344', 'v0.1.0']

    // mocking
    const on = vi.fn().mockImplementationOnce((event: string, cb: Function) => {
      if (event === 'data') {
        cb(tags.join('\t'))
      }
    })
    vi.mocked(spawn).mockImplementationOnce(() => {
      return { exitCode: null, stdout: { on } } as unknown as ChildProcess
    })

    // assertions
    expect(await gitTags()).toEqual([tags.join('\t')])
  })

  test('semver', async () => {
    const tags = ['0.0.1', '0.0.2.12344', 'next', 'v0.1.0']

    // mocking
    const on = vi.fn().mockImplementationOnce((event: string, cb: Function) => {
      if (event === 'data') {
        cb(tags.join('\n'))
      }
    })
    vi.mocked(spawn).mockImplementationOnce(() => {
      return { exitCode: null, stdout: { on } } as unknown as ChildProcess
    })

    // assertions
    expect(await gitTags({ semver: true })).toEqual(['0.0.1', 'v0.1.0'])
  })

  test('not found git command', async () => {
    // mocking
    vi.mocked(existCommand).mockImplementationOnce(() => Promise.resolve(false))

    // assertions
    await expect(gitTags()).rejects.toThrow('not found git command')
  })

  test('unexpteced error', async () => {
    // mocking
    vi.mocked(spawn).mockImplementationOnce(() => {
      throw new Error('unexpteced error')
    })

    // assertions
    await expect(gitTags()).rejects.toThrow()
  })
})
