import type { CurrentScreen, DeviceSummary } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildAlert, buildAlertsList } from '@/testing/fixtures/alerts'
import { buildDeviceGroupSummary } from '@/testing/fixtures/device-groups'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildInstanceFacts } from '@/testing/fixtures/instance'
import { fakeScreenImages } from '@/testing/images'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { freezeTime } from '@/testing/time'
import { fakeGroupsList } from './deviceGroupHarness'

const NOW = '2026-10-03T07:35:00.000Z'
const SEEN_AT = '2026-10-03T07:31:00.000Z'

const imagePath = (name: string) => `/screens/devices/${name}.png?v=1`

function fallback(kind: 'welcome' | 'noScreen' | 'error' | 'sleep', reason: 'neverPolled' | 'noScreens' | 'asleep'): CurrentScreen {
  return { kind: 'fallback', fallback: kind, reason, screenId: null, imagePath: imagePath(kind), servedAt: reason === 'neverPolled' ? null : SEEN_AT }
}

const KITCHEN = buildDeviceSummary({ id: 'kitchen', name: 'Kitchen', lastSeenAt: SEEN_AT, batteryPercent: 18 })
const HALLWAY = buildDeviceSummary({
  id: 'hallway',
  name: 'Hallway',
  lastSeenAt: SEEN_AT,
  batteryPercent: 76,
  sleep: { enabled: true, start: '23:00', end: '06:00', whileAsleep: 'fallback', inWindow: true, endsAt: '2026-10-04T04:00:00.000Z' },
  currentScreen: fallback('sleep', 'asleep'),
})
const STUDY = buildDeviceSummary({ id: 'study', name: 'Study', lastSeenAt: SEEN_AT, batteryPercent: 54, currentScreen: fallback('noScreen', 'noScreens') })
const ATTIC = buildDeviceSummary({
  id: 'attic',
  name: 'Attic',
  lastSeenAt: SEEN_AT,
  batteryPercent: null,
  isMirrored: true,
  currentScreen: { kind: 'mirror', proxied: false, mirrorMac: 'A4:C1:38:00:00:01', imagePath: imagePath('mirror'), fetchedAt: SEEN_AT },
})
const CELLAR = buildDeviceSummary({ id: 'cellar', name: 'Cellar', lastSeenAt: null, nextPollAt: null, batteryPercent: null, rssi: null, currentScreen: fallback('welcome', 'neverPolled') })
const GARAGE = buildDeviceSummary({ id: 'garage', name: 'Garage', lastSeenAt: SEEN_AT, batteryPercent: 42, currentScreen: { kind: 'deletedScreen', imagePath: null, servedAt: SEEN_AT } })

type Screen = Awaited<ReturnType<typeof mountApp>>

const words = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
const rows = (screen: Screen) => [...screen.getByRole('main').element().querySelectorAll('.device-row')]
const rowOf = (screen: Screen, name: string) => rows(screen).find(row => words(row.querySelector('.name')) === name)!
function saidOf(screen: Screen, name: string) {
  return {
    shows: words(rowOf(screen, name).querySelector('.shows')),
    facts: words(rowOf(screen, name).querySelector('.facts')),
  }
}

async function mountList(devices: DeviceSummary[], alerts = buildAlertsList()) {
  freezeTime(NOW)
  fakeScreenImages()
  fakeShellReads({ devices, alerts })
  const screen = await mountApp({ at: '/devices' })
  await expect.element(screen.getByRole('heading', { level: 1, name: 'Devices' })).toBeVisible()
  return screen
}

describe('the Devices list', () => {
  it('lists every Device by name, each a link to its Screens view with its Current Screen as a plate without the seal', async () => {
    const screen = await mountList([KITCHEN, HALLWAY, STUDY])
    const main = screen.getByRole('main')

    await expect.element(main.getByRole('link', { name: 'Hallway', exact: true })).toHaveAttribute('href', '/devices/hallway')
    expect(rows(screen).map(row => words(row.querySelector('.name')))).toEqual(['Hallway', 'Kitchen', 'Study'])
    await expect.element(main.getByRole('img', { name: 'On Kitchen: Calendar' })).toBeVisible()
    expect(main.element().querySelector('.seal')).toBeNull()
    await expect.element(main.getByRole('link', { name: 'Connect a Device' })).toHaveAttribute('href', '/connect')
  })

  it('says what each Device shows: an Active Screen, Sleep Mode, no Screens and Mirroring', async () => {
    const screen = await mountList([KITCHEN, HALLWAY, STUDY, ATTIC])

    await expect.poll(() => rows(screen).length).toBe(4)
    expect(saidOf(screen, 'Kitchen').shows).toBe('Showing Calendar')
    expect(saidOf(screen, 'Hallway').shows).toBe('Asleep until 06:00')
    expect(saidOf(screen, 'Study').shows).toBe('No Screens yet')
    expect(saidOf(screen, 'Attic').shows).toBe('Mirrored from TRMNL')
  })

  it('says the Screen it shows was deleted, and requests no image for it', async () => {
    const screen = await mountList([KITCHEN, GARAGE])

    await expect.poll(() => rows(screen).length).toBe(2)
    expect(saidOf(screen, 'Garage').shows).toBe('The Screen was deleted')
    expect(rowOf(screen, 'Garage').querySelector('.image')).toBeNull()
  })

  it('gives each Device its facts, a firing Alert first and alone in red', async () => {
    const screen = await mountList([KITCHEN, HALLWAY, ATTIC], buildAlertsList({
      active: [
        buildAlert({ kind: 'device-low-battery', device: { id: 'kitchen', name: 'Kitchen' } }),
        buildAlert({ id: 'offline', kind: 'device-offline', device: { id: 'attic', name: 'Attic' } }),
      ],
    }))

    await expect.poll(() => saidOf(screen, 'Kitchen').facts).toBe('Alert: battery low · Last seen 4 min ago · Battery 18 %')
    expect(saidOf(screen, 'Hallway').facts).toBe('Last seen 4 min ago · Battery 76 %')
    expect(saidOf(screen, 'Attic').facts).toBe('Alert: offline · Last seen 4 min ago')
    expect(elementsInSealColour(rowOf(screen, 'Kitchen')).map(words)).toEqual(['Alert: battery low', ''])
    expect(elementsInSealColour(rowOf(screen, 'Hallway'))).toEqual([])
  })

  it('reads "Has not called in yet", with no battery fact, for a Device that never polled', async () => {
    const screen = await mountList([KITCHEN, CELLAR])

    await expect.poll(() => rows(screen).length).toBe(2)
    expect(saidOf(screen, 'Cellar')).toEqual({ shows: 'Waiting for Cellar\'s first poll', facts: 'Has not called in yet' })
  })

  it('opens Connect a Device in its place when there are no Devices', async () => {
    freezeTime(NOW)
    fakeShellReads({ devices: [] })
    const screen = await mountApp({ at: '/devices' })

    await expect.element(screen.getByRole('heading', { level: 1, name: 'Connect your Device' })).toBeVisible()
    expect(screen.router.currentRoute.value.path).toBe('/connect')
  })

  it('shows the notice when the Devices cannot be loaded, and the list once "Try again" works', async () => {
    freezeTime(NOW)
    fakeScreenImages()
    let answers = false
    api.use(
      http.get(apiUrl('instance'), () => HttpResponse.json(buildInstanceFacts())),
      http.get(apiUrl('alerts'), () => HttpResponse.json(buildAlertsList())),
      http.get(apiUrl('device-groups'), () => HttpResponse.json([])),
      http.get(apiUrl('devices'), () => answers ? HttpResponse.json([KITCHEN, HALLWAY]) : apiErrorResponse({ statusCode: 500, code: 'internal' })),
    )
    const screen = await mountApp({ at: '/devices' })

    await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not load the Devices. Something went wrong on the server.')
    expect(elementsInSealColour(screen.getByRole('main').element())).toEqual([])

    answers = true
    await screen.getByRole('button', { name: 'Try again' }).click()

    await expect.poll(() => rows(screen).length).toBe(2)
    expect(screen.getByRole('alert').query()).toBeNull()
  })

  it('shows three empty rows and "Loading Devices" while the answer takes long', async () => {
    freezeTime(NOW)
    let answer = () => {}
    const held = new Promise<void>((resolve) => {
      answer = resolve
    })
    api.use(
      http.get(apiUrl('instance'), () => HttpResponse.json(buildInstanceFacts())),
      http.get(apiUrl('alerts'), () => HttpResponse.json(buildAlertsList())),
      http.get(apiUrl('device-groups'), () => HttpResponse.json([])),
      http.get(apiUrl('devices'), async () => {
        await held
        return HttpResponse.json([KITCHEN, HALLWAY])
      }),
    )
    const screen = await mountApp({ at: '/devices' })

    await expect.element(screen.getByRole('main').getByRole('status')).toHaveTextContent('Loading Devices')
    expect(screen.getByRole('main').element().querySelectorAll('.loading-row')).toHaveLength(3)

    answer()
    await expect.poll(() => rows(screen).length).toBe(2)
  })

  it('is accessible in both themes and does not overflow at phone, tablet or desktop width', async () => {
    const screen = await mountList([KITCHEN, HALLWAY, STUDY, ATTIC, CELLAR], buildAlertsList({ active: [buildAlert({ kind: 'device-low-battery', device: { id: 'kitchen', name: 'Kitchen' } })] }))
    await expect.poll(() => rows(screen).length).toBe(5)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})

describe('the Device Groups under the Devices', () => {
  const groups = (screen: Screen) => screen.getByRole('main').element().querySelector('.device-groups')

  it('lists every Group with its Devices and Screens counted, each a link to its page, and names a Device\'s Group among its facts', async () => {
    fakeGroupsList([
      buildDeviceGroupSummary({ id: 'downstairs', name: 'Downstairs', memberCount: 2, screenCount: 3 }),
      buildDeviceGroupSummary({ id: 'upstairs', name: 'Upstairs', memberCount: 1, screenCount: 0 }),
    ])
    const screen = await mountApp({ at: '/devices' })

    await expect.element(screen.getByRole('main').getByRole('link', { name: 'Downstairs' })).toHaveAttribute('href', '/device-groups/downstairs')
    expect([...groups(screen)!.querySelectorAll('.group-row')].map(row => [words(row.querySelector('.name')), words(row.querySelector('.facts'))])).toEqual([['Downstairs', '2 Devices · 3 Screens'], ['Upstairs', '1 Device · 0 Screens']])
    await expect.poll(() => saidOf(screen, 'Kitchen').facts).toBe('In Downstairs · Last seen 4 min ago · Battery 76 %')
    expect(saidOf(screen, 'Study').facts).toBe('Last seen 4 min ago · Battery 76 %')
  })

  it('says there are none yet', async () => {
    fakeGroupsList([])
    const screen = await mountApp({ at: '/devices' })

    await expect.element(screen.getByText('No Device Groups yet. A Group is one set of Screens that several Devices show together, each at its own pace.')).toBeVisible()
  })

  it('creates a Group from "New Group" and opens its page; an empty name is refused on the field', async () => {
    const faked = fakeGroupsList([])
    const screen = await mountApp({ at: '/devices' })

    await screen.getByRole('button', { name: 'New Group' }).click()
    const field = screen.getByRole('group', { name: 'New Group' }).getByRole('textbox', { name: 'Name' })
    await expect.element(field).toHaveFocus()
    await screen.getByRole('button', { name: 'Create Group' }).click()
    await expect.element(screen.getByText('A Device Group needs a name.')).toBeVisible()
    expect(faked.created).toEqual([])

    await field.fill(' Lobby ')
    await userEvent.keyboard('{Enter}')

    await expect.poll(() => faked.created).toEqual([{ name: 'Lobby' }])
    await expect.poll(() => screen.router.currentRoute.value.path).toBe('/device-groups/new-group')
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Lobby' })).toBeVisible()
  })

  it('says why a Group could not be created and keeps the name, and "Cancel" closes the form and gives the button the focus back', async () => {
    const faked = fakeGroupsList([buildDeviceGroupSummary({ id: 'downstairs', name: 'Downstairs' })])
    faked.refusing = apiErrorResponse({ statusCode: 409, code: 'device-group-name-taken' })
    const screen = await mountApp({ at: '/devices' })

    await screen.getByRole('button', { name: 'New Group' }).click()
    await screen.getByRole('textbox', { name: 'Name' }).fill('Downstairs')
    await screen.getByRole('button', { name: 'Create Group' }).click()
    await expect.element(screen.getByText('There is already a Device Group with that name.')).toBeVisible()
    await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Downstairs')

    await screen.getByRole('button', { name: 'Cancel' }).click()

    expect(screen.getByRole('textbox', { name: 'Name' }).query()).toBeNull()
    await expect.element(screen.getByRole('button', { name: 'New Group' })).toHaveFocus()
  })

  it('shows the notice under the heading when the Groups cannot be loaded, and leaves the Devices alone', async () => {
    fakeGroupsList()
    api.use(http.get(apiUrl('device-groups'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
    const screen = await mountApp({ at: '/devices' })

    await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not load the Device Groups. Something went wrong on the server.')
    await expect.poll(() => rows(screen).length).toBe(3)
  })

  it('is accessible with Groups listed and the form open', async () => {
    fakeGroupsList()
    const screen = await mountApp({ at: '/devices' })
    await expect.element(screen.getByRole('main').getByRole('link', { name: 'Downstairs' })).toBeVisible()
    await screen.getByRole('button', { name: 'New Group' }).click()
    await expect.poll(() => [...document.images].every(image => image.complete)).toBe(true)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
