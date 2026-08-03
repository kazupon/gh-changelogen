import { promises as fs } from 'node:fs'
import { resolve } from 'node:path'

import { cli, define, isArgsValidationError } from 'gunshi'

import packageJson from '../package.json' with { type: 'json' }

import { fetchGithubRelease } from './fetcher'
import { generateChangelog } from './generator'
import { isExists } from './utils'

const GITHUB_TOKEN_KEY = 'GITHUB_TOKEN' as const
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
      default: GITHUB_TOKEN_KEY,
      description: `GitHub token, if you won’t specify, respect '${GITHUB_TOKEN_KEY}' env`
    }
  },
  run: async ctx => {
    if (ctx.positionals.length > 0) {
      throw new Error(`Undefined: ${ctx.positionals[0]}`)
    }

    const token = resolveGithubToken(ctx.values.token)
    const release = await fetchGithubRelease(ctx.values.tag, {
      github: ctx.values.repo,
      token
    })
    const changelog = await generateChangelog(release)
    console.log(changelog)

    const output = resolve(process.cwd(), ctx.values.output)
    await writeChangelog(output, changelog)
  }
})

async function writeChangelog(output: string, changelog: string) {
  let existChangelog = ''
  if (await isExists(output)) {
    existChangelog = (await fs.readFile(output, 'utf-8')).toString()
  }

  await fs.writeFile(output, [changelog, '\n', existChangelog].join(''), 'utf-8')
}

function resolveGithubToken(value: string) {
  let token = value
  if (token === GITHUB_TOKEN_KEY) {
    token = process.env.GITHUB_TOKEN || ''
    if (!token) {
      throw new Error(`Not found ${GITHUB_TOKEN_KEY} in env`)
    }
  }
  return token
}

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
