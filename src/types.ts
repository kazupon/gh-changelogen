/**
 * GitHub Release schema
 *
 * NOTE: `id` type is string
 *
 * @see https://docs.github.com/en/rest/releases/releases
 */
export type GitHubRelease = {
  assets: GitHubAsset[]
  author: GitHubUser
  body: string
  created_at: string
  id: string
  draft: boolean
  prelease: boolean
  name: string
  published_at: string
  tag_name: string
  tarball_url: string
  target_commitish: string
  upload_url: string
  url: string
  zipball_url: string
}

// TODO:
export type GitHubAsset = {
  id: string
}

// TODO:
export type GitHubUser = {
  id: string
  login: string
}

export type Generator = (release: GitHubRelease) => Promise<string>
export type Fetcher = (tag: string) => Promise<GitHubRelease>

export interface Plugin {
  fetcher?: Fetcher
  generator?: Generator
}
