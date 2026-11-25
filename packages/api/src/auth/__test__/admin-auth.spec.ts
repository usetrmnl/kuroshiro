import { describe, expect, it } from 'vitest'
import { AdminAuth, MAX_WRONG_PASSWORDS, SESSION_DAYS } from '../admin-auth.js'

describe('adminAuth', () => {
  it('treats an empty password as none', () => {
    expect(new AdminAuth('').enabled).toBe(false)
    expect(new AdminAuth(undefined).enabled).toBe(false)
  })

  it('verifies a session for 30 days and survives a new instance with the same password', () => {
    let now = 0
    const { value } = new AdminAuth('pw', () => now).issueSession()
    expect(new AdminAuth('pw', () => now).isSession(value)).toBe(true)
    now = SESSION_DAYS * 86_400_000 + 1
    expect(new AdminAuth('pw', () => now).isSession(value)).toBe(false)
  })

  it('signs every browser out when the password changes', () => {
    const { value } = new AdminAuth('one').issueSession()
    expect(new AdminAuth('two').isSession(value)).toBe(false)
  })

  it('rejects malformed cookies', () => {
    const auth = new AdminAuth('pw')
    expect(['', 'x', 'a.b', '1.2.3', undefined].map(c => auth.isSession(c))).toEqual([false, false, false, false, false])
  })

  it('throttles after five wrong passwords until the minute is over', () => {
    let now = 0
    const auth = new AdminAuth('pw', () => now)
    for (let i = 0; i < MAX_WRONG_PASSWORDS; i++)
      auth.recordWrong('a')
    expect(auth.isThrottled('a')).toBe(true)
    expect(auth.isThrottled('b')).toBe(false)
    now = 60_001
    expect(auth.isThrottled('a')).toBe(false)
  })
})
