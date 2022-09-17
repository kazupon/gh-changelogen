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

// TODO:
export interface GitHubAsset {
  id: number
}

// TODO:
export interface GitHubUser {
  id: number
  login: string
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
