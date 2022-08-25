import { vi } from 'vitest'
import { existCommand } from '../../utils'
import { spawn } from 'node:child_process'

import type { ChildProcess } from 'node:child_process'

vi.mock('node:child_process', () => {
  return {
    spawn: vi.fn()
  }
})

describe('existCommand', () => {
  test('found', async () => {
    // mocking
    vi.mocked(spawn).mockImplementationOnce(() => {
      return { exitCode: 0 } as ChildProcess
    })

    // assertions
    expect(await existCommand('git')).toBe(true)
  })

  test('not found', async () => {
    // mocking
    vi.mocked(spawn).mockImplementationOnce(() => {
      return { exitCode: 1 } as ChildProcess
    })

    // assertions
    expect(await existCommand('git')).toBe(false)
  })

  test('found via "exit" event', async () => {
    // mocking
    const on = vi.fn().mockImplementationOnce((_, cb: Function) => cb(0))
    vi.mocked(spawn).mockImplementationOnce(() => {
      return { exitCode: null, on } as unknown as ChildProcess
    })

    // assertions
    expect(await existCommand('git')).toBe(true)
  })

  test('unexpteced error', async () => {
    // mocking
    vi.mocked(spawn).mockImplementationOnce(() => {
      throw new Error('unexpteced error')
    })

    // assertions
    await expect(existCommand('git')).rejects.toThrow()
  })
})
