import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { basename, dirname, join } from 'node:path'

import type { ChangelogUpdateAction } from './types'

export interface ChangelogStoreOptions {
  entry: string
  output: string
  releaseUrl: string
}

export interface ChangelogStoreDependencies {
  createTemporaryPath?: (output: string) => string
  rename?: (from: string, to: string) => Promise<void>
}

interface ChangelogSection {
  end: number
  start: number
}

export async function storeChangelogEntry(
  options: ChangelogStoreOptions,
  dependencies: ChangelogStoreDependencies = {}
): Promise<ChangelogUpdateAction> {
  const parent = dirname(options.output)
  let parentStats
  try {
    parentStats = await fs.stat(parent)
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new Error(`Output directory does not exist: ${parent}`)
    }
    throw error
  }
  if (!parentStats.isDirectory()) {
    throw new Error(`Output parent is not a directory: ${parent}`)
  }

  let existing: string | undefined
  let existingMode: number | undefined
  try {
    existing = await fs.readFile(options.output, 'utf8')
    existingMode = (await fs.stat(options.output)).mode & 0o7777
  } catch (error) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      throw error
    }
  }

  const lineEnding = detectLineEnding(existing ?? '')
  const fileEntry = `${convertLineEndings(options.entry, lineEnding)}${lineEnding}`
  let action: ChangelogUpdateAction
  let content: string

  if (existing === undefined) {
    action = 'created'
    content = fileEntry
  } else {
    const matches = findTopLevelSections(existing).filter(section =>
      existing.slice(section.start, section.end).includes(options.releaseUrl)
    )

    if (matches.length > 1) {
      throw new Error(`Multiple CHANGELOG sections found for ${options.releaseUrl}`)
    }

    if (matches.length === 0) {
      action = 'prepended'
      content = `${fileEntry}${existing}`
    } else {
      const [match] = matches
      content = `${existing.slice(0, match.start)}${fileEntry}${existing.slice(match.end)}`
      action = content === existing ? 'unchanged' : 'replaced'
    }
  }

  if (action !== 'unchanged') {
    await writeAtomically(options.output, content, existingMode, dependencies)
  }

  return action
}

export function findTopLevelSections(content: string): ChangelogSection[] {
  const starts: number[] = []
  const heading = /^# /gmu
  let match: RegExpExecArray | null

  while ((match = heading.exec(content)) !== null) {
    starts.push(match.index)
  }

  return starts.map((start, index) => ({
    end: starts[index + 1] ?? content.length,
    start
  }))
}

function detectLineEnding(content: string): '\n' | '\r\n' {
  return content.match(/\r\n|\n/u)?.[0] === '\r\n' ? '\r\n' : '\n'
}

function convertLineEndings(content: string, lineEnding: '\n' | '\r\n'): string {
  return content.replace(/\r\n|\r|\n/gu, '\n').replace(/\n/gu, lineEnding)
}

async function writeAtomically(
  output: string,
  content: string,
  existingMode: number | undefined,
  dependencies: ChangelogStoreDependencies
): Promise<void> {
  const createTemporaryPath = dependencies.createTemporaryPath ?? defaultTemporaryPath
  const rename = dependencies.rename ?? fs.rename
  const temporaryPath = createTemporaryPath(output)
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined
  let temporaryCreated = false

  try {
    handle = await fs.open(temporaryPath, 'wx', existingMode ?? 0o666)
    temporaryCreated = true
    if (existingMode !== undefined) {
      await handle.chmod(existingMode)
    }
    await handle.writeFile(content, 'utf8')
    await handle.sync()
    await handle.close()
    handle = undefined
    await rename(temporaryPath, output)
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => {})
    }
    if (temporaryCreated) {
      await fs.unlink(temporaryPath).catch(unlinkError => {
        if (!isNodeError(unlinkError) || unlinkError.code !== 'ENOENT') {
          throw unlinkError
        }
      })
    }
    throw error
  }
}

function defaultTemporaryPath(output: string): string {
  return join(dirname(output), `.${basename(output)}.${process.pid}.${randomUUID()}.tmp`)
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
