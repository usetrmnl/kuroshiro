import type { AssignPluginInput, CreateDeviceGroupInput, CreateMashupInput, CreateScreenInput, DeviceGroup, DeviceGroupSummary, DeviceSummary, GroupScreen, PluginSummary, ReorderScreensInput, ScheduleInput, SetPickedScreenInput, UpdateDeviceGroupInput, UpdateDeviceInput, UpdateScreenInput } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { expect } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceGroup, buildDeviceGroupMember, buildDeviceGroupSummary, buildGroupScreen, buildGroupScreenDeviceState } from '@/testing/fixtures/device-groups'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildPluginSummary } from '@/testing/fixtures/plugins'
import { buildSchedule } from '@/testing/fixtures/screens'
import { fakeScreenImages } from '@/testing/images'
import { freezeTime } from '@/testing/time'
import { EVERY_DAY_ALL_DAY } from '../scheduleEditing'

const NOW = '2026-10-03T07:35:00.000Z'
const RENDERED_AT = '2026-10-03T07:31:00.000Z'

export const GROUP_ID = 'downstairs'

const imagePath = (deviceId: string, screenId: string) => `/screens/devices/${deviceId}/${screenId}.png?v=1`

const KITCHEN = buildDeviceGroupMember({ id: 'kitchen', name: 'Kitchen', friendlyId: 'KITCHN' })
const HALLWAY = buildDeviceGroupMember({
  id: 'hallway',
  name: 'Hallway',
  friendlyId: 'HALLWY',
  deviceModel: { name: 'v2', label: 'TRMNL X', width: 1872, height: 1404, deprecated: false },
  palette: { id: 'gray-16', name: 'Greyscale, 16 levels', kind: 'official' },
})

/** The Group Downstairs with Kitchen and Hallway in it. */
export const DOWNSTAIRS = buildDeviceGroup({ id: GROUP_ID, name: 'Downstairs', members: [KITCHEN, HALLWAY] })

/** The Devices as the shell lists them: the two members, and Study, which is in no Group. */
export const DEVICES: DeviceSummary[] = [
  buildDeviceSummary({ id: 'kitchen', name: 'Kitchen', deviceGroup: { id: GROUP_ID, name: 'Downstairs' } }),
  buildDeviceSummary({ id: 'hallway', name: 'Hallway', deviceGroup: { id: GROUP_ID, name: 'Downstairs' } }),
  buildDeviceSummary({ id: 'study', name: 'Study', deviceGroup: null }),
]

const PLUGINS: PluginSummary[] = [
  buildPluginSummary({ id: 'weather', name: 'Weather' }),
  buildPluginSummary({ id: 'calendar', name: 'Calendar' }),
]

function memberState(deviceId: string, screenId: string, overrides: Partial<ReturnType<typeof buildGroupScreenDeviceState>> = {}) {
  return buildGroupScreenDeviceState({ deviceId, imagePath: imagePath(deviceId, screenId), renderedAt: RENDERED_AT, generatedAt: RENDERED_AT, ...overrides })
}

/** A Screen of Downstairs with Kitchen's and Hallway's state on it. */
function groupScreen(screen: Partial<GroupScreen> & { id: string }, states: { kitchen?: Partial<ReturnType<typeof buildGroupScreenDeviceState>>, hallway?: Partial<ReturnType<typeof buildGroupScreenDeviceState>> } = {}): GroupScreen {
  return buildGroupScreen({
    deviceGroupId: GROUP_ID,
    perDevice: [memberState('kitchen', screen.id, states.kitchen), memberState('hallway', screen.id, states.hallway)],
    ...screen,
  })
}

/** Three Screens: a Plugin Screen Kitchen shows and Hallway turns to next, a File Screen Hallway shows, and an HTML Screen nobody shows. */
export const GROUP_SCREENS: GroupScreen[] = [
  groupScreen({ id: 'weather', name: 'Weather', order: 1, plugin: { id: 'weather', name: 'Weather', kind: 'Poll', requiredFieldEmpty: false, fetchAlertFiring: false } }, {
    kitchen: { isActive: true, state: 'active' },
    hallway: { state: 'upNext' },
  }),
  groupScreen({ id: 'photo', name: 'Harbour photo', order: 2, kind: 'file', plugin: null, file: { originalName: 'harbour.png', width: 1600, height: 960, bytes: 421_888, uploadedAt: '2026-09-12T10:00:00.000Z' } }, {
    kitchen: { state: 'upNext' },
    hallway: { isActive: true, state: 'active' },
  }),
  groupScreen({ id: 'notes', name: 'Notes', order: 3, kind: 'html', plugin: null, html: '<h1>Notes</h1>', schedule: buildSchedule() }, {
    hallway: { imagePath: null, renderedAt: null, generatedAt: null },
  }),
]

/** A write the page made: its method, its path under `/api/` and what it sent. */
export interface Write {
  method: string
  path: string
  body?: unknown
}

export interface FakedGroup {
  group: DeviceGroup
  screens: GroupScreen[]
  devices: DeviceSummary[]
  summaries: DeviceGroupSummary[]
  writes: Write[]
  /** While set, every write to the Group's name is answered with it. */
  refusingRename?: Response
}

interface GroupOptions {
  group?: DeviceGroup
  screens?: GroupScreen[]
  devices?: DeviceSummary[]
}

/** The id every Screen the fake adds is given. */
export const NEW_SCREEN_ID = 'new-screen'

function scheduled(screen: GroupScreen, input: ScheduleInput): GroupScreen {
  return { ...screen, schedule: { ...buildSchedule(EVERY_DAY_ALL_DAY), ...screen.schedule, ...input } }
}

/**
 * Fakes the Group Downstairs with what its page reads and every write it makes: the Group, its Screens, its members
 * joining and leaving, and each member's Picked Screen. A write changes the faked records as the server would and is kept in `writes`.
 */
export function fakeDownstairs({ group = DOWNSTAIRS, screens = GROUP_SCREENS, devices = DEVICES }: GroupOptions = {}): FakedGroup {
  const faked: FakedGroup = {
    group,
    screens,
    devices,
    summaries: [buildDeviceGroupSummary({ id: GROUP_ID, name: group.name, memberCount: group.members.length, screenCount: screens.length })],
    writes: [],
  }
  const answerChanged = (id: string, change: (screen: GroupScreen) => GroupScreen) => {
    faked.screens = faked.screens.map(screen => screen.id === id ? change(screen) : screen)
    return HttpResponse.json(faked.screens.find(screen => screen.id === id))
  }
  const memberOf = (device: DeviceSummary) => buildDeviceGroupMember({ id: device.id, name: device.name, friendlyId: device.friendlyId, deviceModel: device.deviceModel, palette: null })

  freezeTime(NOW)
  fakeScreenImages()
  fakeShellReads({ devices: faked.devices, groups: faked.summaries })
  api.use(
    http.get(apiUrl('devices'), () => HttpResponse.json(faked.devices)),
    http.get(apiUrl('device-groups'), () => HttpResponse.json(faked.summaries)),
    http.get(apiUrl(`device-groups/${GROUP_ID}`), () => HttpResponse.json(faked.group)),
    http.get(apiUrl(`device-groups/${GROUP_ID}/screens`), () => HttpResponse.json(faked.screens)),
    http.get(apiUrl('plugins'), () => HttpResponse.json(PLUGINS)),
    http.patch(apiUrl(`device-groups/${GROUP_ID}`), async ({ request }) => {
      const body = await request.json() as UpdateDeviceGroupInput
      faked.writes.push({ method: 'PATCH', path: `device-groups/${GROUP_ID}`, body })
      if (faked.refusingRename)
        return faked.refusingRename.clone()
      faked.group = { ...faked.group, name: body.name ?? faked.group.name }
      faked.devices = faked.devices.map(device => device.deviceGroup?.id === GROUP_ID ? { ...device, deviceGroup: { id: GROUP_ID, name: faked.group.name } } : device)
      return HttpResponse.json(faked.group)
    }),
    http.delete(apiUrl(`device-groups/${GROUP_ID}`), () => {
      faked.writes.push({ method: 'DELETE', path: `device-groups/${GROUP_ID}` })
      faked.devices = faked.devices.map(device => ({ ...device, deviceGroup: null }))
      faked.summaries = []
      return new HttpResponse(null, { status: 204 })
    }),
    http.put(apiUrl(`device-groups/${GROUP_ID}/screens/order`), async ({ request }) => {
      const { screenIds } = await request.json() as ReorderScreensInput
      faked.writes.push({ method: 'PUT', path: `device-groups/${GROUP_ID}/screens/order`, body: { screenIds } })
      faked.screens = screenIds.map((id, index) => ({ ...faked.screens.find(screen => screen.id === id)!, order: index + 1 }))
      return HttpResponse.json(faked.screens)
    }),
    http.patch(apiUrl('devices/:id'), async ({ request, params }) => {
      const body = await request.json() as UpdateDeviceInput
      faked.writes.push({ method: 'PATCH', path: `devices/${params.id}`, body })
      const device = faked.devices.find(candidate => candidate.id === params.id)!
      const joins = body.deviceGroupId === GROUP_ID
      faked.devices = faked.devices.map(candidate => candidate.id === device.id ? { ...candidate, deviceGroup: joins ? { id: GROUP_ID, name: faked.group.name } : null } : candidate)
      faked.group = {
        ...faked.group,
        members: joins
          ? [...faked.group.members, memberOf(device)].sort((a, b) => a.name.localeCompare(b.name))
          : faked.group.members.filter(member => member.id !== device.id),
      }
      faked.screens = faked.screens.map(screen => ({
        ...screen,
        perDevice: joins
          ? [...screen.perDevice, buildGroupScreenDeviceState({ deviceId: device.id, imagePath: null, renderedAt: null, generatedAt: null })]
          : screen.perDevice.filter(state => state.deviceId !== device.id),
      }))
      return HttpResponse.json({ ...device, deviceGroup: joins ? { id: GROUP_ID, name: faked.group.name } : null })
    }),
    http.put(apiUrl('devices/:id/picked-screen'), async ({ request, params }) => {
      const body = await request.json() as SetPickedScreenInput
      faked.writes.push({ method: 'PUT', path: `devices/${params.id}/picked-screen`, body })
      faked.screens = faked.screens.map(screen => ({
        ...screen,
        perDevice: screen.perDevice.map((state) => {
          if (state.deviceId !== params.id)
            return state
          if (screen.id === body.screenId)
            return { ...state, state: 'upNext', picked: true }
          return state.state === 'upNext' ? { ...state, state: null, picked: false } : state
        }),
      }))
      return HttpResponse.json([])
    }),
    http.delete(apiUrl('devices/:id/picked-screen'), ({ params }) => {
      faked.writes.push({ method: 'DELETE', path: `devices/${params.id}/picked-screen` })
      faked.screens = faked.screens.map(screen => ({
        ...screen,
        perDevice: screen.perDevice.map(state => state.deviceId === params.id && state.picked ? { ...state, state: null, picked: false } : state),
      }))
      return HttpResponse.json([])
    }),
    http.post(apiUrl('screens'), async ({ request }) => {
      const body = await request.json() as CreateScreenInput
      faked.writes.push({ method: 'POST', path: 'screens', body })
      const added = groupScreen({ id: NEW_SCREEN_ID, name: body.name, kind: body.kind, order: faked.screens.length + 1, plugin: null, html: body.kind === 'html' ? body.html : null }, {
        kitchen: { imagePath: null, renderedAt: null, generatedAt: null },
        hallway: { imagePath: null, renderedAt: null, generatedAt: null },
      })
      faked.screens = [...faked.screens, added]
      return HttpResponse.json(added, { status: 201 })
    }),
    http.post(apiUrl('mashup'), async ({ request }) => {
      faked.writes.push({ method: 'POST', path: 'mashup', body: await request.json() as CreateMashupInput })
      return HttpResponse.json(faked.screens[0], { status: 201 })
    }),
    http.post(apiUrl('plugins/:pluginId/assign'), async ({ request, params }) => {
      faked.writes.push({ method: 'POST', path: `plugins/${params.pluginId}/assign`, body: await request.json() as AssignPluginInput })
      return HttpResponse.json(faked.screens[0], { status: 201 })
    }),
    http.patch(apiUrl('screens/:id'), async ({ request, params }) => {
      const body = await request.json() as UpdateScreenInput
      faked.writes.push({ method: 'PATCH', path: `screens/${params.id}`, body })
      return answerChanged(String(params.id), screen => ({ ...screen, name: body.name ?? screen.name, html: body.html ?? screen.html, dither: body.dither ?? screen.dither }))
    }),
    http.delete(apiUrl('screens/:id'), ({ params }) => {
      faked.writes.push({ method: 'DELETE', path: `screens/${params.id}` })
      faked.screens = faked.screens.filter(screen => screen.id !== params.id).map((screen, index) => ({ ...screen, order: index + 1 }))
      return new HttpResponse(null, { status: 204 })
    }),
    http.delete(apiUrl(`plugins/:pluginId/assignments/device-groups/${GROUP_ID}`), ({ params }) => {
      faked.writes.push({ method: 'DELETE', path: `plugins/${params.pluginId}/assignments/device-groups/${GROUP_ID}` })
      faked.screens = faked.screens.filter(screen => screen.plugin?.id !== params.pluginId).map((screen, index) => ({ ...screen, order: index + 1 }))
      return new HttpResponse(null, { status: 204 })
    }),
    ...(['post', 'patch'] as const).map(method => http[method](apiUrl('screens/:id/schedule'), async ({ request, params }) => {
      const body = await request.json() as ScheduleInput
      faked.writes.push({ method: method.toUpperCase(), path: `screens/${params.id}/schedule`, body })
      return answerChanged(String(params.id), screen => scheduled(screen, body))
    })),
    http.delete(apiUrl('screens/:id/schedule'), ({ params }) => {
      faked.writes.push({ method: 'DELETE', path: `screens/${params.id}/schedule` })
      return answerChanged(String(params.id), screen => ({ ...screen, schedule: null }))
    }),
  )
  return faked
}

/** Fakes what the Devices list reads for its Groups section, and `POST /api/device-groups`. */
export function fakeGroupsList(summaries: DeviceGroupSummary[] = [buildDeviceGroupSummary({ id: GROUP_ID, name: 'Downstairs' })], devices: DeviceSummary[] = DEVICES) {
  const faked = { summaries, created: [] as CreateDeviceGroupInput[], refusing: undefined as Response | undefined }
  freezeTime(NOW)
  fakeScreenImages()
  fakeShellReads({ devices, groups: summaries })
  api.use(
    http.get(apiUrl('device-groups'), () => HttpResponse.json(faked.summaries)),
    http.post(apiUrl('device-groups'), async ({ request }) => {
      const body = await request.json() as CreateDeviceGroupInput
      faked.created.push(body)
      if (faked.refusing)
        return faked.refusing.clone()
      const group = buildDeviceGroup({ id: 'new-group', name: body.name, members: [] })
      faked.summaries = [...faked.summaries, buildDeviceGroupSummary({ id: group.id, name: group.name, memberCount: 0, screenCount: 0 })]
      api.use(
        http.get(apiUrl('device-groups/new-group'), () => HttpResponse.json(group)),
        http.get(apiUrl('device-groups/new-group/screens'), () => HttpResponse.json([])),
      )
      return HttpResponse.json(group, { status: 201 })
    }),
  )
  return faked
}

export type MountedApp = Awaited<ReturnType<typeof mountApp>>

export async function mountGroup(query = '') {
  const screen = await mountApp({ at: `/device-groups/${GROUP_ID}${query}` })
  await expect.element(screen.getByRole('heading', { level: 1, name: 'Downstairs' })).toBeVisible()
  return screen
}

export const words = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

/** The opened row of the Screen the address names. */
export async function openedRow(screen: MountedApp, name: string) {
  const region = screen.getByRole('region', { name, exact: true })
  await expect.element(region).toBeVisible()
  return region
}

/** The member chips each Screen row words, by the row's name, in the Order the rows stand in. */
export function rowChips(screen: MountedApp) {
  return [...screen.getByRole('main').element().querySelectorAll('.screens-in-order .screen-row')].map(row => [words(row.querySelector('.trigger')), words(row.querySelector('.chips'))])
}
