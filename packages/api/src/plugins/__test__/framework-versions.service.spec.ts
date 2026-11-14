import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, stubFetch } from '../../test/fetch.js'
import { FrameworkVersionsService } from '../services/framework-versions.service.js'

const mockFetch = stubFetch()

const RELEASES = [
  { tag_name: 'v3.4.6' },
  { tag_name: '3.10.0' },
  { tag_name: 'v3.4.10' },
  { tag_name: 'v3.5.0-beta.1', prerelease: true },
  { tag_name: 'v3.9.9', draft: true },
  { tag_name: 'nightly' },
  { tag_name: 'v3.4.6' },
  null,
]

describe('the Framework versions', () => {
  let service: FrameworkVersionsService

  beforeEach(() => {
    mockFetch.mockReset()
    service = new FrameworkVersionsService()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('answers the released versions, newest first, from the framework\'s GitHub releases', async () => {
    mockFetch.mockResolvedValue(jsonResponse(RELEASES))

    expect(await service.versions()).toEqual(['3.10.0', '3.4.10', '3.4.6'])
    expect(String(mockFetch.mock.calls[0][0])).toContain('https://api.github.com/repos/usetrmnl/trmnl-framework/releases')
  })

  it('asks GitHub once for readers who arrive together', async () => {
    mockFetch.mockImplementation(async () => jsonResponse(RELEASES))

    await Promise.all([service.versions(), service.versions()])

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('holds them in memory for an hour', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    mockFetch.mockImplementation(async () => jsonResponse(RELEASES))

    await service.versions()
    vi.advanceTimersByTime(59 * 60_000)
    await service.versions()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(2 * 60_000)
    await service.versions()
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['answers 403 rate-limited', () => jsonResponse({}, { status: 403 })],
    ['answers 429', () => jsonResponse({}, { status: 429 })],
    ['cannot be reached', () => Promise.reject(new TypeError('fetch failed'))],
    ['answers without a list', () => jsonResponse({ message: 'nope' })],
  ])('answers none when GitHub %s, and does not ask again for ten minutes', async (_what, answer) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    mockFetch.mockImplementation(answer as () => Promise<Response>)

    expect(await service.versions()).toEqual([])
    expect(await service.versions()).toEqual([])
    expect(mockFetch).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(11 * 60_000)
    mockFetch.mockImplementation(async () => jsonResponse(RELEASES))
    expect(await service.versions()).toEqual(['3.10.0', '3.4.10', '3.4.6'])
  })
})
