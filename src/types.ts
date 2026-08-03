/**
 * GitHub Releases schema
 *
 * @see https://docs.github.com/en/rest/releases/releases
 */
export interface GitHubRelease {
  assets: GitHubAsset[]
  author: GitHubUser
  body: string
  created_at: string
  id: number
  draft: boolean
  prelease: boolean
  name: string
  published_at: string
  tag_name: string
  tarball_url: string
  target_commitish: string
  html_url: string
  upload_url: string
  url: string
  zipball_url: string
}

// Minimal asset shape required by the current public API.
export interface GitHubAsset {
  id: number
}

// Minimal user shape required by the current public API.
export interface GitHubUser {
  id: number
  login: string
}

/**
 * Generated release notes returned by GitHub.
 *
 * @see https://docs.github.com/en/rest/releases/releases#generate-release-notes-content-for-a-release
 */
export interface GitHubGeneratedReleaseNotes {
  body: string
  name: string
}

export type ReleaseNotesSource = 'published-release' | 'generated-notes'

/**
 * Release notes normalized independently of their GitHub API source.
 */
export interface ReleaseNotes {
  body: string
  htmlUrl: string
  name: string
  repository: string
  source: ReleaseNotesSource
  tagName: string
  targetCommitish?: string
  timestamp: string
}

export interface GenerateGithubReleaseNotesOptions {
  repository: string
  tagName: string
  targetCommitish?: string
  token?: string
}

export interface UpdateChangelogOptions {
  output?: string
  repository: string
  source?: ReleaseNotesSource
  tagName: string
  targetCommitish?: string
  token?: string
}

export type ChangelogUpdateAction = 'created' | 'prepended' | 'replaced' | 'unchanged'

export interface UpdateChangelogResult {
  action: ChangelogUpdateAction
  entry: string
  output: string
  releaseNotes: ReleaseNotes
}

/**
 * Changelog generator
 */
export type Generator = (release: GitHubRelease) => Promise<string>

/**
 * Github releases fetcher
 */
export type Fetcher = (tag: string) => Promise<GitHubRelease>

/**
 * Fetcher options
 */
export interface FetcherOptions {
  /**
   * GitHub info, format: `owner/repo`
   */
  github?: string
  /**
   * GitHub Token
   */
  token?: string
}

export interface Plugin {
  fetcher?: Fetcher
  generator?: Generator
}
