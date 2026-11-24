import type { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'

/** The cookie the admin UI is signed in by. */
export const SESSION_COOKIE = 'kuroshiro_admin'

export const SESSION_DAYS = 30
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000

/** Wrong passwords one address may send within the window before it is answered 429. */
export const MAX_WRONG_PASSWORDS = 5
const WINDOW_MS = 60 * 1000

function digest(value: string, key: string): Buffer {
  return createHmac('sha256', key).update(value).digest()
}

/** Constant-time, and of the same length whatever the inputs are, as Device API keys are compared. */
function sameText(given: string, expected: string): boolean {
  return timingSafeEqual(digest(given, 'compare'), digest(expected, 'compare'))
}

/**
 * The admin password of this Instance (`KUROSHIRO_ADMIN_PASSWORD`, ADR-0079): who may call the admin API,
 * the signed cookie that stands for a correct password for 30 days, and the slowing of guesses.
 * The cookie holds no state: it carries its expiry and a signature by a key derived from the password,
 * so it survives a restart and changing the password signs every browser out.
 */
export class AdminAuth {
  private readonly key: string | undefined
  private readonly wrongByAddress = new Map<string, number[]>()

  constructor(private readonly password: string | undefined, private readonly now: () => number = Date.now) {
    this.key = password ? createHmac('sha256', 'kuroshiro admin session').update(password).digest('hex') : undefined
  }

  get enabled(): boolean {
    return this.password !== undefined && this.password !== ''
  }

  isPassword(given: string): boolean {
    return this.enabled && sameText(given, this.password!)
  }

  issueSession(): { value: string, maxAgeMs: number } {
    const expires = String(this.now() + SESSION_MS)
    return { value: `${expires}.${digest(expires, this.key!).toString('base64url')}`, maxAgeMs: SESSION_MS }
  }

  isSession(cookie: string | undefined): boolean {
    if (!this.enabled || !cookie)
      return false
    const [expires, signature, ...rest] = cookie.split('.')
    if (!expires || !signature || rest.length > 0 || !/^\d+$/.test(expires))
      return false
    return Number(expires) > this.now() && sameText(signature, digest(expires, this.key!).toString('base64url'))
  }

  /** Whether this address has used up its wrong passwords for the current minute. */
  isThrottled(address: string): boolean {
    return this.recentWrong(address).length >= MAX_WRONG_PASSWORDS
  }

  recordWrong(address: string): void {
    this.wrongByAddress.set(address, [...this.recentWrong(address), this.now()])
  }

  private recentWrong(address: string): number[] {
    const recent = (this.wrongByAddress.get(address) ?? []).filter(at => this.now() - at < WINDOW_MS)
    if (recent.length === 0)
      this.wrongByAddress.delete(address)
    return recent
  }
}
