import { resolve } from 'node:path'

import { storeChangelogEntry } from './changelog'
import { fetchGithubGeneratedReleaseNotes, fetchGithubRelease } from './fetcher'
import { renderChangelogEntry } from './generator'
import { resolveGitCommitish } from './git'
import {
  normalizeGeneratedReleaseNotes,
  normalizePublishedRelease,
  parseGithubRepository
} from './release-notes'
import { resolveGithubToken } from './token'

import type {
  GenerateGithubReleaseNotesOptions,
  ReleaseNotes,
  UpdateChangelogOptions,
  UpdateChangelogResult
} from './types'
import type { ChangelogStoreOptions } from './changelog'
import type { FetchGithubGeneratedReleaseNotesOptions } from './fetcher'
import type { GithubTokenEnvironment } from './token'

const DEFAULT_CHANGELOG_FILE = 'CHANGELOG.md' as const

export interface ChangelogApplicationDependencies {
  clock: () => Date
  cwd: () => string
  environment: GithubTokenEnvironment
  fetch: typeof fetch
  fetchGeneratedReleaseNotes: (
    options: FetchGithubGeneratedReleaseNotesOptions,
    fetcher?: typeof fetch
  ) => Promise<{ body: string; name: string }>
  fetchRelease: typeof fetchGithubRelease
  resolveCommitish: typeof resolveGitCommitish
  storeEntry: (options: ChangelogStoreOptions) => Promise<UpdateChangelogResult['action']>
}

export async function generateGithubReleaseNotes(
  options: GenerateGithubReleaseNotesOptions
): Promise<ReleaseNotes> {
  return generateGithubReleaseNotesWithDependencies(options)
}

export async function generateGithubReleaseNotesWithDependencies(
  options: GenerateGithubReleaseNotesOptions,
  overrides: Partial<ChangelogApplicationDependencies> = {}
): Promise<ReleaseNotes> {
  const dependencies = resolveDependencies(overrides)
  const startedAt = snapshotClock(dependencies.clock)
  const cwd = dependencies.cwd()
  validateRequest(options.repository, options.tagName)
  const token = resolveGithubToken(options.token, dependencies.environment)

  return generateGithubReleaseNotesCore(options, token, startedAt, cwd, dependencies)
}

export async function updateChangelog(
  options: UpdateChangelogOptions
): Promise<UpdateChangelogResult> {
  return updateChangelogWithDependencies(options)
}

export async function updateChangelogWithDependencies(
  options: UpdateChangelogOptions,
  overrides: Partial<ChangelogApplicationDependencies> = {}
): Promise<UpdateChangelogResult> {
  const dependencies = resolveDependencies(overrides)
  const startedAt = snapshotClock(dependencies.clock)
  const cwd = dependencies.cwd()
  const source = options.source ?? 'published-release'
  validateRequest(options.repository, options.tagName)

  if (source !== 'published-release' && source !== 'generated-notes') {
    throw new Error(`Unsupported release notes source: ${String(source)}`)
  }
  if (source === 'published-release' && options.targetCommitish !== undefined) {
    throw new Error('targetCommitish requires generated-notes source')
  }

  const token = resolveGithubToken(options.token, dependencies.environment)
  const releaseNotes =
    source === 'generated-notes'
      ? await generateGithubReleaseNotesCore(options, token, startedAt, cwd, dependencies)
      : normalizePublishedRelease(
          options.repository,
          await dependencies.fetchRelease(options.tagName, {
            github: options.repository,
            token
          })
        )
  const entry = renderChangelogEntry(releaseNotes)
  const output = resolve(cwd, options.output ?? DEFAULT_CHANGELOG_FILE)
  const action = await dependencies.storeEntry({
    entry,
    output,
    releaseUrl: releaseNotes.htmlUrl
  })

  return {
    action,
    entry,
    output,
    releaseNotes
  }
}

async function generateGithubReleaseNotesCore(
  options: GenerateGithubReleaseNotesOptions,
  token: string,
  startedAt: Date,
  cwd: string,
  dependencies: ChangelogApplicationDependencies
): Promise<ReleaseNotes> {
  const targetCommitish = await dependencies.resolveCommitish(options.targetCommitish ?? 'HEAD', {
    cwd
  })
  const generated = await dependencies.fetchGeneratedReleaseNotes(
    {
      repository: options.repository,
      tagName: options.tagName,
      targetCommitish,
      token
    },
    dependencies.fetch
  )

  return normalizeGeneratedReleaseNotes({
    generated,
    repository: options.repository,
    startedAt,
    tagName: options.tagName,
    targetCommitish
  })
}

function validateRequest(repository: string, tagName: string): void {
  parseGithubRepository(repository)
  if (!tagName) {
    throw new Error('GitHub release tag name is required')
  }
}

function snapshotClock(clock: () => Date): Date {
  return new Date(clock().getTime())
}

function resolveDependencies(
  overrides: Partial<ChangelogApplicationDependencies>
): ChangelogApplicationDependencies {
  return {
    clock: () => new Date(),
    cwd: () => process.cwd(),
    environment: process.env,
    fetch: globalThis.fetch,
    fetchGeneratedReleaseNotes: fetchGithubGeneratedReleaseNotes,
    fetchRelease: fetchGithubRelease,
    resolveCommitish: resolveGitCommitish,
    storeEntry: storeChangelogEntry,
    ...overrides
  }
}
