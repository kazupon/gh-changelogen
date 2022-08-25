import { generateChangelog } from '../../generator'
import { normalizeGithubRelease } from '../../utils'
import release from '../fixtures/release.json'

import type { Generator } from '../../types'

describe('generateChangelog', () => {
  test('default', async () => {
    expect(await generateChangelog(normalizeGithubRelease(release))).toMatchSnapshot()
  })

  test('custom generator', async () => {
    const myGenerator: Generator = async release => {
      return new Promise(resolve => {
        // do something ...
        setTimeout(() => resolve(`# ${release.name}`), 100)
      })
    }

    expect(await generateChangelog(normalizeGithubRelease(release), myGenerator)).toContain(release.name)
  })

  test.todo('not compatible generator', async () => {
    // not callable generator
    const myGenerator: Generator = 'not callable' as unknown as Generator

    // assertions
    await expect(generateChangelog(normalizeGithubRelease(release), myGenerator)).rejects.toThrow(
      'generator is not a function'
    )
  })
})
