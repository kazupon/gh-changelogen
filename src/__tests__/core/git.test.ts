import { vi } from 'vite-plus/test'
import { spawn } from 'node:child_process'
import { gitTags, resolveGitCommitish } from '../../git'
import { existCommand } from '../../utils'

import type { ChildProcess } from 'node:child_process'

vi.mock('../../utils', () => {
  return {
    existCommand: vi.fn<typeof existCommand>().mockImplementation(() => Promise.resolve(true))
  }
})

vi.mock('node:child_process', () => {
  return {
    spawn: vi.fn<typeof spawn>()
  }
})

describe('gitTags', () => {
  test('git tag format', async () => {
    const tags = ['0.0.1', '0.0.2.12344', 'v0.1.0']

    // mocking
    const on = vi
      .fn<(event: string, cb: (value: string) => void) => void>()
      .mockImplementationOnce((event, cb) => {
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
    const on = vi
      .fn<(event: string, cb: (value: string) => void) => void>()
      .mockImplementationOnce((event, cb) => {
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
    const on = vi
      .fn<(event: string, cb: (value: string) => void) => void>()
      .mockImplementationOnce((event, cb) => {
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
    const on = vi
      .fn<(event: string, cb: (value: string) => void) => void>()
      .mockImplementationOnce((event, cb) => {
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
    await expect(gitTags()).rejects.toThrow('unexpteced error')
  })
})

describe('resolveGitCommitish process handling', () => {
  test('collects all stdout chunks and waits for close', async () => {
    const stdoutOn = vi.fn<(event: string, callback: (chunk: string) => void) => void>(
      (event, callback) => {
        if (event === 'data') {
          callback('01234567')
          callback('89abcdef\n')
        }
      }
    )
    const stderrOn = vi.fn<(event: string, callback: (chunk: string) => void) => void>()
    const once = vi.fn<(event: string, callback: (value: never) => void) => void>(
      (event, callback) => {
        if (event === 'close') {
          callback(0 as never)
        }
      }
    )
    vi.mocked(spawn).mockReturnValueOnce({
      kill: vi.fn<() => boolean>(() => true),
      once,
      stderr: { on: stderrOn, setEncoding: vi.fn<() => void>() },
      stdout: { on: stdoutOn, setEncoding: vi.fn<() => void>() }
    } as unknown as ChildProcess)

    await expect(resolveGitCommitish('--help', { cwd: '/repo' })).resolves.toBe('0123456789abcdef')
    expect(spawn).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--verify', '--end-of-options', '--help^{commit}'],
      {
        cwd: '/repo',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      }
    )
  })

  test('reports a missing git executable', async () => {
    const error = Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' })
    vi.mocked(spawn).mockImplementationOnce(() => {
      throw error
    })

    await expect(resolveGitCommitish('HEAD')).rejects.toThrow('git command not found')
  })

  test('reports spawn errors emitted by the child', async () => {
    const once = vi.fn<(event: string, callback: (value: never) => void) => void>(
      (event, callback) => {
        if (event === 'error') {
          callback(new Error('spawn failed') as never)
        }
      }
    )
    vi.mocked(spawn).mockReturnValueOnce({
      kill: vi.fn<() => boolean>(() => true),
      once,
      stderr: {
        on: vi.fn<(event: string, callback: (chunk: string) => void) => void>(),
        setEncoding: vi.fn<() => void>()
      },
      stdout: {
        on: vi.fn<(event: string, callback: (chunk: string) => void) => void>(),
        setEncoding: vi.fn<() => void>()
      }
    } as unknown as ChildProcess)

    await expect(resolveGitCommitish('HEAD')).rejects.toThrow('spawn failed')
  })
})
