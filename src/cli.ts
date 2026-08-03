import { cli, define, isArgsValidationError } from 'gunshi'

import packageJson from '../package.json' with { type: 'json' }

import { updateChangelog } from './application'

const DEFAULT_CHANGELOG_FILE = 'CHANGELOG.md' as const
const CLI_NAME = 'gh-changelogen' as const
const CLI_DESCRIPTION = 'Changelog generator for GitHub Releases' as const
const CLI_VERSION = packageJson.version

const command = define({
  name: CLI_NAME,
  description: CLI_DESCRIPTION,
  args: {
    repo: {
      type: 'string',
      required: true,
      description: 'GitHub repository name, format `owner/repo` (e.g. `kazupon/gh-changelogen`)'
    },
    tag: {
      type: 'string',
      required: true,
      description: 'GitHub release tag (e.g. `v0.0.1`)'
    },
    output: {
      type: 'string',
      default: DEFAULT_CHANGELOG_FILE,
      description: `Changelog file name to create or update. defaults to '${DEFAULT_CHANGELOG_FILE}' and resolved relative`
    },
    token: {
      type: 'string',
      description: 'GitHub token; defaults to GH_TOKEN, then GITHUB_TOKEN'
    },
    generateNotes: {
      type: 'boolean',
      default: false,
      toKebab: true,
      description: 'Generate release notes for a future tag instead of fetching an existing release'
    },
    target: {
      type: 'string',
      default: 'HEAD',
      description: 'Commitish for generated notes; resolved to an exact commit SHA'
    }
  },
  run: async ctx => {
    if (ctx.positionals.length > 0) {
      throw new Error(`Undefined: ${ctx.positionals[0]}`)
    }

    if (ctx.explicit.target && !ctx.values.generateNotes) {
      throw new Error('--target requires --generate-notes')
    }

    const result = await updateChangelog({
      output: ctx.values.output,
      repository: ctx.values.repo,
      source: ctx.values.generateNotes ? 'generated-notes' : 'published-release',
      tagName: ctx.values.tag,
      token: ctx.values.token,
      ...(ctx.values.generateNotes ? { targetCommitish: ctx.values.target } : {})
    })
    console.log(result.entry)
  }
})

export function isCliValidationError(error: unknown): boolean {
  return (
    error instanceof AggregateError &&
    error.errors.length > 0 &&
    error.errors.every(isArgsValidationError)
  )
}

export async function main(args: string[]) {
  const normalizedArgs = args.length === 0 ? ['--help'] : args
  return cli(normalizedArgs, command, {
    name: CLI_NAME,
    description: CLI_DESCRIPTION,
    version: CLI_VERSION,
    renderHeader: null,
    strict: false
  })
}
