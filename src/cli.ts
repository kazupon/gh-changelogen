import z from 'zod'
import { parse as _parse } from 'zodiarg'
import { promises as fs } from 'node:fs'
import { resolve } from 'node:path'
import { fetchGithubRelease } from './fetcher'
import { generateChangelog } from './generator'
import { isExists } from './utils'

const GITHUB_TOKEN_KEY = 'GITHUB_TOKEN' as const

function parse(args: string[]) {
  return _parse(
    {
      // e.g. --key value | --key=value
      options: {
        repo: z.string().describe('GitHub repository name (e.g. owner/repo)'),
        tag: z.string().describe('GitHub Release tag'),
        output: z.string().default('CHANGELOG.md').describe('Updagte changelog file path'),
        token: z.string().default('GITHUB_TOKEN').describe('GitHub token')
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
      throw new Error('Not found GITHUB_TOKEN in env')
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
