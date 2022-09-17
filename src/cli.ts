import { promises as fs } from 'node:fs'
import { resolve } from 'node:path'

import z from 'zod'
import { parse as _parse } from 'zodiarg'

import { fetchGithubRelease } from './fetcher'
import { generateChangelog } from './generator'
import { isExists } from './utils'

const GITHUB_TOKEN_KEY = 'GITHUB_TOKEN' as const
const DEFAULT_CHANGELOG_FILE = 'CHANGELOG.md' as const

function parse(args: string[]) {
  return _parse(
    {
      // e.g. --key value | --key=value
      options: {
        repo: z.string().describe('GitHub repository name, format `owner/repo` (e.g. `kazupon/gh-changelogen`)'),
        tag: z.string().describe('GitHub release tag (e.g. `v0.0.1`)'),
        output: z
          .string()
          .default(DEFAULT_CHANGELOG_FILE)
          .describe(
            `Changelog file name to create or update. defaults to '${DEFAULT_CHANGELOG_FILE}' and resolved relative`
          ),
        token: z
          .string()
          .default(GITHUB_TOKEN_KEY)
          .describe(`GitHub token, if you won’t specify, respect '${GITHUB_TOKEN_KEY}' env`)
      },
      // e.g. --flagA, --flagB
      flags: {},
      // ... positional args: foo 10
      args: [],
      // e.g. alias map: s => shortable
      alias: {}
    },
    args,
    // options
    { helpWithNoArgs: true, help: true }
  )
}

async function writeChangelog(output: string, changelog: string) {
  let existChangelog = ''
  if (await isExists(output)) {
    existChangelog = (await fs.readFile(output, 'utf-8')).toString()
  }

  await fs.writeFile(output, [changelog, '\n', existChangelog].join(''), 'utf-8')
}

export async function main(args: string[]) {
  const input = parse(args)

  let token = input.options.token
  if (token === GITHUB_TOKEN_KEY) {
    token = process.env.GITHUB_TOKEN || ''
    if (!token) {
      throw new Error(`Not found ${GITHUB_TOKEN_KEY} in env`)
    }
  }

  const release = await fetchGithubRelease(input.options.tag, {
    github: input.options.repo,
    token
  })
  const changelog = await generateChangelog(release)
  console.log(changelog)

  const output = resolve(process.cwd(), input.options.output)
  await writeChangelog(output, changelog)
}
