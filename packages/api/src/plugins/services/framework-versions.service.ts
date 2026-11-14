import { Injectable, Logger } from '@nestjs/common'
import { FRAMEWORK_VERSION_PATTERN } from 'kuroshiro-shared'
import { downloadLimited } from '../../utils/downloadLimited.js'
import { getErrorMessage } from '../../utils/getErrorMessage.js'

// The host is fixed here: nothing the admin sends names where Kuroshiro fetches from.
const RELEASES_URL = 'https://api.github.com/repos/usetrmnl/trmnl-framework/releases?per_page=100'

const FETCH_TIMEOUT_MS = 15_000
const READ_LIMIT_BYTES = 4 * 1024 * 1024
const VERSIONS_HELD_MS = 60 * 60_000
/** A failed read (GitHub down or rate-limited) is not asked again for this long, so a busy page cannot hammer it. */
const FAILURE_HELD_MS = 10 * 60_000

function compareVersionsNewestFirst(a: string, b: string): number {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  return right[0] - left[0] || right[1] - left[1] || right[2] - left[2]
}

/** The versions in the body of GitHub's releases list: published releases whose tag is a version, newest first. */
function versionsOf(body: unknown): string[] {
  if (!Array.isArray(body))
    throw new TypeError('what it answered is not a list of releases')
  const versions = new Set<string>()
  for (const release of body) {
    if (typeof release !== 'object' || release === null)
      continue
    const { tag_name: tag, draft, prerelease } = release as Record<string, unknown>
    if (draft === true || prerelease === true || typeof tag !== 'string')
      continue
    const version = tag.replace(/^v/, '')
    if (FRAMEWORK_VERSION_PATTERN.test(version))
      versions.add(version)
  }
  return [...versions].sort(compareVersionsNewestFirst)
}

/** The TRMNL Framework versions TRMNL has released, read through Kuroshiro from the GitHub releases Renovate follows. Held in memory only. */
@Injectable()
export class FrameworkVersionsService {
  private readonly logger = new Logger(FrameworkVersionsService.name)
  private held: { versions: string[], until: number } | null = null

  /** Newest first; none when GitHub could not be asked, and the Plugin's field stays a text box. */
  async versions(): Promise<string[]> {
    if (this.held && Date.now() < this.held.until)
      return this.held.versions
    try {
      const { status, ok, buffer } = await downloadLimited(RELEASES_URL, { limitBytes: READ_LIMIT_BYTES, timeoutMs: FETCH_TIMEOUT_MS })
      if (!ok)
        throw new Error(`it answered ${status}`)
      const versions = versionsOf(JSON.parse(buffer.toString('utf8')))
      this.held = { versions, until: Date.now() + VERSIONS_HELD_MS }
      return versions
    }
    catch (error) {
      this.logger.warn(`TRMNL's Framework versions could not be read from GitHub: ${getErrorMessage(error)}`)
      this.held = { versions: [], until: Date.now() + FAILURE_HELD_MS }
      return []
    }
  }
}
