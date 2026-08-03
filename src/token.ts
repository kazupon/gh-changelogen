const GH_TOKEN_KEY = 'GH_TOKEN' as const
const GITHUB_TOKEN_KEY = 'GITHUB_TOKEN' as const

export interface GithubTokenEnvironment {
  GH_TOKEN?: string
  GITHUB_TOKEN?: string
}

export function resolveGithubToken(
  explicitToken?: string,
  environment: GithubTokenEnvironment = process.env
): string {
  const token = firstNonEmpty(explicitToken, environment.GH_TOKEN, environment.GITHUB_TOKEN)

  if (!token) {
    throw new Error(
      `GitHub token is required; use --token or set ${GH_TOKEN_KEY} or ${GITHUB_TOKEN_KEY}`
    )
  }

  return token
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  return values.find(value => value !== undefined && value.length > 0)
}
