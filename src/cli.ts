import z from 'zod'
import { parse as _parse } from 'zodiarg'
import { fetchGithubRelease } from './fetcher'
import { generateChangelog } from './generator'

const GITHUB_TOKEN_KEY = 'GITHUB_TOKEN' as const

function parse(args: string[]) {
  return _parse(
    {
      // e.g. --key value | --key=value
      options: {
        repo: z.string().describe('GitHub repository name (e.g. owner/repo)'),
        tag: z.string().describe('GitHub Release tag'),
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
}
