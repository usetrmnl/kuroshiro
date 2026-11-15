import type { DeviceDetail, ScreenRead } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceDetail, buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildSchedule, buildScreen } from '@/testing/fixtures/screens'
import { fakeScreenImages } from '@/testing/images'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { freezeTime } from '@/testing/time'

const NOW = '2026-10-03T07:35:00.000Z'
const SERVED_AT = '2026-10-03T07:31:00.000Z'
const GROUP = { id: 'downstairs', name: 'Downstairs' }

const imagePath = (id: string) => `/screens/devices/kitchen/${id}.png?v=1`

/** What Kitchen shows: the Group's three Screens, read with Kitchen's own state. */
const SHOWN: ScreenRead[] = [
  buildScreen({ id: 'weather', deviceId: 'kitchen', readOnly: true, name: 'Weather', order: 1, state: 'active', imagePath: imagePath('weather') }),
  buildScreen({ id: 'photo', deviceId: 'kitchen', readOnly: true, name: 'Harbour photo', order: 2, kind: 'file', plugin: null, state: 'upNext', imagePath: imagePath('photo'), file: { originalName: 'harbour.png', width: 1600, height: 960, bytes: 421_888, uploadedAt: '2026-09-12T10:00:00.000Z' } }),
  buildScreen({ id: 'notes', deviceId: 'kitchen', readOnly: true, name: 'Notes', order: 3, kind: 'html', plugin: null, html: '<h1>Notes</h1>', imagePath: null, renderedAt: null, schedule: buildSchedule({ enabled: false }), state: 'scheduleOff' }),
]

/** Kitchen's own Screens, parked while it is in the Group. */
const OWN: ScreenRead[] = [
  buildScreen({ id: 'calendar', deviceId: 'kitchen', name: 'Calendar', order: 1, state: null, imagePath: imagePath('calendar') }),
  buildScreen({ id: 'trains', deviceId: 'kitchen', name: 'Train departures', order: 2, kind: 'external', plugin: null, state: null, imagePath: imagePath('trains'), external: { url: 'https://departures.example/central.png', fetchManual: true } }),
]

function kitchen(overrides: Partial<DeviceDetail> = {}) {
  return buildDeviceDetail({
    id: 'kitchen',
    name: 'Kitchen',
    lastSeenAt: SERVED_AT,
    screenCount: OWN.length,
    deviceGroup: GROUP,
    currentScreen: { kind: 'screen', screenId: 'weather', name: 'Weather', imagePath: imagePath('weather'), renderedAt: SERVED_AT, servedAt: SERVED_AT, paused: false, holding: false },
    ...overrides,
  })
}

function fakeGroupedKitchen({ shown = SHOWN, own = OWN } = {}) {
  const writes: string[] = []
  freezeTime(NOW)
  fakeScreenImages()
  fakeShellReads({ devices: [buildDeviceSummary({ id: 'kitchen', name: 'Kitchen', deviceGroup: GROUP })] })
  api.use(
    http.get(apiUrl('devices/kitchen'), () => HttpResponse.json(kitchen())),
    http.get(apiUrl('devices/kitchen/screens'), () => HttpResponse.json(shown)),
    http.get(apiUrl('devices/kitchen/screens/own'), () => HttpResponse.json(own)),
    http.put(apiUrl('devices/kitchen/picked-screen'), async ({ request }) => {
      writes.push(`PUT picked-screen ${((await request.json()) as { screenId: string }).screenId}`)
      return HttpResponse.json(shown)
    }),
  )
  return { writes }
}

async function mountKitchen(query = '') {
  const screen = await mountApp({ at: `/devices/kitchen${query}` })
  await expect.element(screen.getByRole('heading', { level: 1, name: 'Kitchen' })).toBeVisible()
  return screen
}

const words = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

describe('the Screens view of a Device in a Device Group', () => {
  it('says the Screens are the Group\'s, with a link to it, and shows them with this Device\'s own state and no reordering', async () => {
    fakeGroupedKitchen()
    const screen = await mountKitchen()
    const main = screen.getByRole('main')

    await expect.element(main.getByRole('link', { name: 'Downstairs' })).toHaveAttribute('href', '/device-groups/downstairs')
    expect(words(main.element())).toContain('Screens from Downstairs, shown by every Device in it. They are edited there; Kitchen walks the Order at its own pace.')
    const rows = [...main.element().querySelectorAll('.screens-in-order .screen-row')]
    expect(rows.map(row => [words(row.querySelector('.trigger')), words(row.querySelector('.state'))])).toEqual([['Weather', 'Active Screen'], ['Harbour photo', 'Up next'], ['Notes', 'Schedule off']])
    expect(main.element().querySelector('.screens-in-order [data-grip]')).toBeNull()
    expect(screen.getByRole('banner').getByRole('link', { name: 'Add Screen' }).query()).toBeNull()
  })

  it('opens a Screen read-only: no Rename, no move, no Delete, no Schedule switch, the Schedule as a summary, and a way to the Group', async () => {
    fakeGroupedKitchen()
    const screen = await mountKitchen('?screen=notes')
    const row = screen.getByRole('region', { name: 'Notes', exact: true })

    await expect.element(row.getByRole('link', { name: 'Open on Downstairs' })).toHaveAttribute('href', '/device-groups/downstairs?screen=notes')
    await expect.element(row.getByText('Edited on Downstairs, for every Device in it.')).toBeVisible()
    expect(row.getByRole('button', { name: 'Rename' }).query()).toBeNull()
    expect(row.getByRole('button', { name: 'Move up' }).query()).toBeNull()
    expect(row.getByRole('button', { name: 'Delete Screen' }).query()).toBeNull()
    expect(row.getByRole('switch').query()).toBeNull()
    expect(words(row.getByRole('group', { name: 'Schedule' }).element())).toContain('06:00–09:00')
  })

  it('still lets this Device pick a Screen to show next', async () => {
    const faked = fakeGroupedKitchen({ shown: SHOWN.map(shown => shown.id === 'notes' ? { ...shown, state: null, schedule: null } : shown) })
    const screen = await mountKitchen('?screen=notes')
    const row = screen.getByRole('region', { name: 'Notes', exact: true })

    await row.getByRole('button', { name: 'Show next' }).click()

    await expect.poll(() => faked.writes).toEqual(['PUT picked-screen notes'])
  })

  it('tucks the Device\'s own Screens away as parked, counted, and lists them without a state when opened', async () => {
    fakeGroupedKitchen()
    const screen = await mountKitchen()
    const main = screen.getByRole('main')

    const tucked = main.getByRole('button', { name: /Kitchen's own Screens, parked/ })
    await expect.poll(() => words(tucked.element())).toContain('2 Screens')
    await tucked.click()

    await expect.element(main.getByText('Kept while Kitchen is in Downstairs, and shown again from the first in their Order when it leaves. Nothing here can be changed until then.')).toBeVisible()
    await expect.element(main.getByRole('button', { name: 'Calendar' })).toBeVisible()
    await expect.element(main.getByRole('button', { name: 'Train departures' })).toBeVisible()
    await main.getByRole('button', { name: 'Calendar' }).click()
    await expect.element(main.getByText('Parked. It comes back when Kitchen leaves Downstairs.')).toBeVisible()
  })

  it('says a Device without own Screens has none to park', async () => {
    fakeGroupedKitchen({ own: [] })
    const screen = await mountKitchen()
    const main = screen.getByRole('main')

    await main.getByRole('button', { name: /Kitchen's own Screens, parked/ }).click()

    await expect.element(main.getByText('Kitchen has no Screens of its own.')).toBeVisible()
  })

  it('points at the Group when it has no Screens yet', async () => {
    fakeGroupedKitchen({ shown: [] })
    const screen = await mountKitchen()

    await expect.element(screen.getByRole('heading', { level: 2, name: 'No Screens in Downstairs yet' })).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'Open Downstairs' })).toHaveAttribute('href', '/device-groups/downstairs')
  })

  it('is accessible in both themes and does not overflow at phone, tablet or desktop width', async () => {
    fakeGroupedKitchen()
    const screen = await mountKitchen('?screen=photo')
    await expect.element(screen.getByRole('region', { name: 'Harbour photo', exact: true })).toBeVisible()
    await screen.getByRole('main').getByRole('button', { name: /Kitchen's own Screens, parked/ }).click()
    await expect.element(screen.getByRole('main').getByRole('button', { name: 'Calendar' })).toBeVisible()
    await expect.poll(() => [...document.images].every(image => image.complete)).toBe(true)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
