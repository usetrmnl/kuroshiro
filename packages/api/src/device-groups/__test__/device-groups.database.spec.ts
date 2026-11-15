import type { DeviceGroup as DeviceGroupRead, DeviceGroupSummary, GroupScreen, ScreenRead } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { HttpTestApp } from '../../test/httpApp.js'
import * as fs from 'node:fs'
import path from 'node:path'
import { ConfigService } from '@nestjs/config'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Alert } from '../../alerts/entities/alert.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { PluginFieldValue } from '../../plugins/entities/plugin-field-value.entity.js'
import { PluginField } from '../../plugins/entities/plugin-field.entity.js'
import { PluginFieldValuesService } from '../../plugins/services/plugin-field-values.service.js'
import { nextEligibleScreen } from '../../schedule/rotation.js'
import { DeviceScreen } from '../../screens/device-screen.entity.js'
import { DeviceScreensController } from '../../screens/device-screens.controller.js'
import { PickedScreenController } from '../../screens/picked-screen.controller.js'
import { PickedScreenService } from '../../screens/picked-screen.service.js'
import { originalImagePath, screenImagePath } from '../../screens/screen-image-paths.js'
import { ScreenReadsService } from '../../screens/screen-reads.service.js'
import { rotationScreensOf } from '../../screens/screen-states.js'
import { ScreensController } from '../../screens/screens.controller.js'
import { Screen } from '../../screens/screens.entity.js'
import { ScreensService } from '../../screens/screens.service.js'
import { shownRecordsOf } from '../../screens/shown-records.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { createMockDeviceModelsService, primeMockDeviceModelsService } from '../../test/mockDeviceModelsService.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { convertToPng, readImageSize } from '../../utils/imageUtils.js'
import { resolveAppPath } from '../../utils/pathHelper.js'
import { DeviceGroupMembershipService } from '../device-group-membership.service.js'
import { DeviceGroup } from '../device-group.entity.js'
import { DeviceGroupsController } from '../device-groups.controller.js'
import { DeviceGroupsService } from '../device-groups.service.js'

vi.mock('../../utils/imageUtils.js', () => ({
  downloadImage: vi.fn(),
  convertToPng: vi.fn(),
  readImageSize: vi.fn(),
}))

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

async function writeFile(destination: string, content: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(destination), { recursive: true })
  await fs.promises.writeFile(destination, content)
}

describe('device Groups, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let membership: DeviceGroupMembershipService
  let screensService: ScreensService
  let screenReads: ScreenReadsService
  let kitchen: Device
  let hall: Device
  const config = { get: vi.fn() }
  const groupIds: string[] = []

  beforeAll(async () => {
    database = await createTestDatabase()
    await database.query(`ALTER TABLE "screen" ADD CONSTRAINT "UQ_screen_device_group_order" UNIQUE ("deviceGroupId", "order") DEFERRABLE INITIALLY DEFERRED`)
    const deviceModels = createMockDeviceModelsService()
    primeMockDeviceModelsService(deviceModels)
    const fieldValues = new PluginFieldValuesService(database.getRepository(PluginFieldValue), database.getRepository(PluginField))
    const screens = database.getRepository(Screen)
    const records = database.getRepository(DeviceScreen)
    const devices = database.getRepository(Device)

    screenReads = new ScreenReadsService(screens, records, devices, database.getRepository(Alert), fieldValues)
    screensService = new ScreensService(screens, records, devices, asService<ConfigService>(config), asService<DeviceModelsService>(deviceModels))
    membership = new DeviceGroupMembershipService(devices, database.getRepository(DeviceGroup), records)
    const groups = new DeviceGroupsService(database.getRepository(DeviceGroup), devices, screens, membership, screensService)

    http = await createHttpTestApp({
      controllers: [DeviceGroupsController, ScreensController, DeviceScreensController, PickedScreenController],
      providers: [
        { provide: DeviceGroupsService, useValue: groups },
        { provide: ScreensService, useValue: screensService },
        { provide: ScreenReadsService, useValue: screenReads },
        { provide: PickedScreenService, useValue: new PickedScreenService(devices, screens, records) },
        { provide: ConfigService, useValue: asService<ConfigService>(config) },
      ],
    })
  })

  beforeEach(async () => {
    config.get.mockReturnValue(false)
    vi.mocked(readImageSize).mockResolvedValue({ width: 1600, height: 960 })
    vi.mocked(convertToPng).mockImplementation(async (input, output) => writeFile(output, `converted:${await fs.promises.readFile(input, 'utf8')}`))
    await database.getRepository(Device).createQueryBuilder().delete().execute()
    await database.getRepository(DeviceGroup).createQueryBuilder().delete().execute()
    kitchen = await database.getRepository(Device).save({ name: 'Kitchen', friendlyId: 'KITCHN', mac: 'AA:BB:CC:DD:EE:01', apikey: 'k1', refreshRate: 300 })
    hall = await database.getRepository(Device).save({ name: 'Hall', friendlyId: 'HALLWY', mac: 'AA:BB:CC:DD:EE:02', apikey: 'k2', refreshRate: 300 })
  })

  afterEach(async () => {
    for (const id of [kitchen.id, hall.id, ...groupIds.splice(0)])
      await fs.promises.rm(resolveAppPath('public', 'screens', 'devices', id), { recursive: true, force: true })
  })

  afterAll(async () => {
    await http.app.close()
    await database.destroy()
  })

  async function createGroup(name = 'Downstairs'): Promise<DeviceGroupRead> {
    const response = await http.postJson('/api/device-groups', { name })
    expect(response.status).toBe(201)
    const group: DeviceGroupRead = await response.json()
    groupIds.push(group.id)
    return group
  }

  async function join(device: Device, groupId: string | null): Promise<void> {
    const fresh = await database.getRepository(Device).findOneByOrFail({ id: device.id })
    await membership.setGroup(fresh, groupId)
  }

  async function addGroupScreen(groupId: string, name: string): Promise<string> {
    const response = await http.postJson('/api/screens', { owner: { kind: 'deviceGroup', id: groupId }, kind: 'html', name, html: `<p>${name}</p>` })
    expect(response.status).toBe(201)
    return (await response.json()).id
  }

  async function addOwnScreen(device: Device, name: string): Promise<string> {
    const response = await http.postJson('/api/screens', { owner: { kind: 'device', id: device.id }, kind: 'html', name, html: `<p>${name}</p>` })
    expect(response.status).toBe(201)
    return (await response.json()).id
  }

  /** What one `/display` poll does to Rotation: the next eligible Screen of what the Device shows becomes its Active one. */
  async function poll(device: Device): Promise<string | undefined> {
    const fresh = await database.getRepository(Device).findOneByOrFail({ id: device.id })
    const records = await shownRecordsOf({ screens: database.getRepository(Screen), records: database.getRepository(DeviceScreen) }, fresh, { create: true })
    const next = nextEligibleScreen(records.map(record => ({ record, ...rotationScreensOf([record])[0] })), new Date(), null)
    await database.getRepository(DeviceScreen).update({ device: { id: device.id } }, { isActive: false })
    if (next)
      await database.getRepository(DeviceScreen).update({ id: next.record.id }, { isActive: true })
    return next?.record.screen.id
  }

  async function groupScreens(groupId: string): Promise<GroupScreen[]> {
    const response = await http.request(`/api/device-groups/${groupId}/screens`)
    expect(response.status).toBe(200)
    return response.json()
  }

  describe('the Group routes', () => {
    it('creates a Group, refuses a second of the same name with 409, and lists member and Screen counts', async () => {
      const group = await createGroup()
      expect(group).toEqual({ id: expect.any(String), name: 'Downstairs', members: [] })

      const refusal = await http.postJson('/api/device-groups', { name: 'Downstairs' })
      expect(refusal.status).toBe(409)
      expect(await refusal.json()).toMatchObject({ code: 'device-group-name-taken' })

      await join(kitchen, group.id)
      await addGroupScreen(group.id, 'Clock')
      const list: DeviceGroupSummary[] = await (await http.request('/api/device-groups')).json()
      expect(list).toEqual([{ id: group.id, name: 'Downstairs', memberCount: 1, screenCount: 1 }])
    })

    it('reads a Group with its members, renames it, and answers 404 for an unknown one', async () => {
      const group = await createGroup()
      await join(kitchen, group.id)

      const detail: DeviceGroupRead = await (await http.request(`/api/device-groups/${group.id}`)).json()
      expect(detail.members).toEqual([{ id: kitchen.id, name: 'Kitchen', friendlyId: 'KITCHN', deviceModel: null, palette: null, isMirrored: false, isProxied: false }])

      const renamed = await http.request(`/api/device-groups/${group.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Upstairs' }) })
      expect(await renamed.json()).toMatchObject({ name: 'Upstairs' })
      expect((await http.request(`/api/device-groups/${UNKNOWN_ID}`)).status).toBe(404)
    })
  })

  describe('adding a Screen', () => {
    it('puts a Screen on a Group with no Device, in the Group\'s own Order', async () => {
      const group = await createGroup()
      await addGroupScreen(group.id, 'First')
      await addGroupScreen(group.id, 'Second')

      const screens = await database.getRepository(Screen).find({ where: { deviceGroup: { id: group.id } }, relations: { device: true }, order: { order: 'ASC' } })
      expect(screens.map(screen => [screen.filename, screen.order, screen.device])).toEqual([['First', 1, null], ['Second', 2, null]])
    })

    it('refuses a body that names no owner with 400, a bare deviceId included', async () => {
      const response = await http.postJson('/api/screens', { deviceId: kitchen.id, kind: 'html', name: 'Mine', html: '<p/>' })

      expect(response.status).toBe(400)
      expect(await database.getRepository(Screen).countBy({ filename: 'Mine' })).toBe(0)
    })

    it('refuses a Group that does not exist with 404', async () => {
      const response = await http.postJson('/api/screens', { owner: { kind: 'deviceGroup', id: UNKNOWN_ID }, kind: 'html', name: 'Lost', html: '<p/>' })
      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'device-group-not-found' })
    })
  })

  describe('membership', () => {
    it('parks a Device\'s own Screens on joining, shows the Group\'s from its first, and brings them back on leaving', async () => {
      const group = await createGroup()
      const groupFirst = await addGroupScreen(group.id, 'Group 1')
      await addGroupScreen(group.id, 'Group 2')
      const own = await addOwnScreen(kitchen, 'Own 1')
      await addOwnScreen(kitchen, 'Own 2')
      await poll(kitchen)
      await database.getRepository(Device).save({ id: kitchen.id, pickedScreen: { id: own } })

      await join(kitchen, group.id)

      const joined = await database.getRepository(Device).findOneOrFail({ where: { id: kitchen.id } })
      expect(joined.pickedScreen).toBeNull()
      expect(await database.getRepository(DeviceScreen).countBy({ device: { id: kitchen.id }, isActive: true })).toBe(0)
      const shown: ScreenRead[] = await (await http.request(`/api/devices/${kitchen.id}/screens`)).json()
      expect(shown.map(screen => [screen.name, screen.readOnly])).toEqual([['Group 1', true], ['Group 2', true]])
      expect(await poll(kitchen)).toBe(groupFirst)
      expect((await database.getRepository(Screen).findOneBy({ id: own }))?.filename).toBe('Own 1')

      await join(kitchen, null)

      const left: ScreenRead[] = await (await http.request(`/api/devices/${kitchen.id}/screens`)).json()
      expect(left.map(screen => [screen.name, screen.readOnly, screen.state])).toEqual([['Own 1', false, 'upNext'], ['Own 2', false, null]])
      expect(await database.getRepository(DeviceScreen).countBy({ device: { id: kitchen.id }, screen: { deviceGroup: { id: group.id } } })).toBe(0)
      expect(await poll(kitchen)).toBe(own)
    })

    it('answers 404 for a Group that does not exist and changes nothing', async () => {
      const fresh = await database.getRepository(Device).findOneByOrFail({ id: kitchen.id })
      await expect(membership.setGroup(fresh, UNKNOWN_ID)).rejects.toMatchObject({ code: 'device-group-not-found' })
    })

    it('has both members leave when the Group is deleted, and removes its Screens and files', async () => {
      const group = await createGroup()
      const groupScreen = await addGroupScreen(group.id, 'Group 1')
      await addOwnScreen(kitchen, 'Own 1')
      await join(kitchen, group.id)
      await join(hall, group.id)
      await poll(kitchen)
      await writeFile(screenImagePath(kitchen.id, groupScreen), 'image')
      await writeFile(originalImagePath(group.id, groupScreen), 'original')

      const response = await http.request(`/api/device-groups/${group.id}`, { method: 'DELETE' })

      expect(response.status).toBe(204)
      expect(await database.getRepository(Screen).countBy({ id: groupScreen })).toBe(0)
      expect((await database.getRepository(Device).findBy({}))).toEqual(expect.arrayContaining([expect.objectContaining({ id: kitchen.id, deviceGroup: null }), expect.objectContaining({ id: hall.id, deviceGroup: null })]))
      await expect(fs.promises.access(screenImagePath(kitchen.id, groupScreen))).rejects.toThrow()
      await expect(fs.promises.access(originalImagePath(group.id, groupScreen))).rejects.toThrow()
      const own: ScreenRead[] = await (await http.request(`/api/devices/${kitchen.id}/screens`)).json()
      expect(own.map(screen => screen.name)).toEqual(['Own 1'])
    })
  })

  describe('rotation', () => {
    it('lets each member walk the Order at its own pace, and reads every member\'s state on the Group\'s Screens', async () => {
      const group = await createGroup()
      const [one, two, three] = [await addGroupScreen(group.id, 'One'), await addGroupScreen(group.id, 'Two'), await addGroupScreen(group.id, 'Three')]
      await join(kitchen, group.id)
      await join(hall, group.id)

      expect(await poll(kitchen)).toBe(one)
      expect(await poll(kitchen)).toBe(two)
      expect(await poll(hall)).toBe(one)

      const screens = await groupScreens(group.id)
      const stateOf = (screenId: string, device: Device) => {
        const entry = screens.find(screen => screen.id === screenId)!.perDevice.find(state => state.deviceId === device.id)!
        return [entry.isActive, entry.state]
      }
      expect(stateOf(one, kitchen)).toEqual([false, null])
      expect(stateOf(two, kitchen)).toEqual([true, 'active'])
      expect(stateOf(three, kitchen)).toEqual([false, 'upNext'])
      expect(stateOf(one, hall)).toEqual([true, 'active'])
      expect(stateOf(two, hall)).toEqual([false, 'upNext'])
      expect(screens.every(screen => screen.perDevice.length === 2)).toBe(true)
    })

    it('names each member\'s rendered image on a Group Screen, and none for a member whose image is not on disk', async () => {
      const group = await createGroup()
      const only = await addGroupScreen(group.id, 'Only')
      await join(kitchen, group.id)
      await join(hall, group.id)
      await poll(kitchen)
      await writeFile(screenImagePath(kitchen.id, only), 'image')

      await writeFile(screenImagePath(kitchen.id, UNKNOWN_ID), 'another Screen\'s image')
      await writeFile(originalImagePath(kitchen.id, only), 'not an image')

      const [screen] = await groupScreens(group.id)

      const byDevice = Object.fromEntries(screen.perDevice.map(state => [state.deviceId, state]))
      expect(byDevice[kitchen.id]).toMatchObject({ imagePath: expect.stringMatching(new RegExp(`^/screens/devices/${kitchen.id}/${only}\\.png\\?v=\\d+$`)), renderedAt: expect.any(String) })
      expect(byDevice[hall.id]).toMatchObject({ imagePath: null, renderedAt: null })
    })

    it('reads every member\'s state with the Group\'s Screens loaded once, a member\'s stored records and placeholders alike', async () => {
      const group = await createGroup()
      const [one, two] = [await addGroupScreen(group.id, 'One'), await addGroupScreen(group.id, 'Two')]
      await join(kitchen, group.id)
      await join(hall, group.id)
      await poll(kitchen)
      const screenFinds = vi.spyOn(database.getRepository(Screen), 'find')

      const screens = await screenReads.forGroup(group.id)

      expect(screenFinds).toHaveBeenCalledTimes(1)
      expect(screens.map(screen => screen.perDevice.map(state => [state.deviceId, state.isActive, state.generatedAt !== null]))).toEqual([
        [[hall.id, false, false], [kitchen.id, true, true]],
        [[hall.id, false, false], [kitchen.id, false, true]],
      ])
      expect(screens.map(screen => screen.id)).toEqual([one, two])
      screenFinds.mockRestore()
    })

    it('puts a member that has not met a Screen yet in the list without a record', async () => {
      const group = await createGroup()
      const only = await addGroupScreen(group.id, 'Only')
      await join(kitchen, group.id)

      const [screen] = await groupScreens(group.id)

      expect(screen.id).toBe(only)
      expect(screen.perDevice).toEqual([expect.objectContaining({ deviceId: kitchen.id, isActive: false, generatedAt: null })])
      expect(await database.getRepository(DeviceScreen).countBy({ screen: { id: only } })).toBe(0)
    })
  })

  describe('a member\'s own Screens', () => {
    it('lists them parked under /screens/own, with no Screen State, while /screens lists the Group\'s', async () => {
      const group = await createGroup()
      await addGroupScreen(group.id, 'Shared')
      await addOwnScreen(kitchen, 'Own 1')
      await addOwnScreen(kitchen, 'Own 2')
      await poll(kitchen)
      await join(kitchen, group.id)

      const own: ScreenRead[] = await (await http.request(`/api/devices/${kitchen.id}/screens/own`)).json()
      const shown: ScreenRead[] = await (await http.request(`/api/devices/${kitchen.id}/screens`)).json()

      expect(own.map(screen => [screen.name, screen.order, screen.state, screen.readOnly, screen.deviceId])).toEqual([['Own 1', 1, null, false, kitchen.id], ['Own 2', 2, null, false, kitchen.id]])
      expect(shown.map(screen => screen.name)).toEqual(['Shared'])
    })

    it('answers the same Screens as /screens for a Device in no Group, and 404 for an unknown Device', async () => {
      await addOwnScreen(kitchen, 'Own 1')
      await poll(kitchen)

      const own: ScreenRead[] = await (await http.request(`/api/devices/${kitchen.id}/screens/own`)).json()

      expect(own).toEqual(await (await http.request(`/api/devices/${kitchen.id}/screens`)).json())
      expect(own[0]!.state).toBe('active')
      expect((await http.request(`/api/devices/${UNKNOWN_ID}/screens/own`)).status).toBe(404)
    })
  })

  describe('the Picked Screen', () => {
    it('takes a Screen of the Device\'s Group, and refuses another Group\'s or a parked own one with 409', async () => {
      const group = await createGroup('Downstairs')
      const other = await createGroup('Upstairs')
      const shown = await addGroupScreen(group.id, 'Shown')
      await addGroupScreen(group.id, 'Next')
      const elsewhere = await addGroupScreen(other.id, 'Elsewhere')
      const parked = await addOwnScreen(kitchen, 'Parked')
      await join(kitchen, group.id)
      const put = (screenId: string) => http.request(`/api/devices/${kitchen.id}/picked-screen`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ screenId }) })

      expect((await put(shown)).status).toBe(200)
      for (const refused of [elsewhere, parked]) {
        const response = await put(refused)
        expect(response.status).toBe(409)
        expect(await response.json()).toMatchObject({ code: 'picked-screen-not-shown' })
      }
    })
  })

  describe('a member\'s Device Model change', () => {
    it('converts the Group\'s file Screens again for that member only, moving its generatedAt', async () => {
      const group = await createGroup()
      const screen = await database.getRepository(Screen).save({ type: 'file', filename: 'Photo', order: 1, fetchManual: false, deviceGroup: { id: group.id } })
      await join(kitchen, group.id)
      await join(hall, group.id)
      await writeFile(originalImagePath(group.id, screen.id), 'photo')
      await writeFile(screenImagePath(kitchen.id, screen.id), 'kitchen-before')
      await writeFile(screenImagePath(hall.id, screen.id), 'hall-before')
      const before = new Date('2026-01-01T00:00:00.000Z')
      await database.getRepository(DeviceScreen).save([{ device: kitchen, screen, generatedAt: before }, { device: hall, screen, generatedAt: before }])

      await screensService.redrawForRenderTarget(await database.getRepository(Device).findOneByOrFail({ id: kitchen.id }))

      await expect(fs.promises.readFile(screenImagePath(kitchen.id, screen.id), 'utf8')).resolves.toBe('converted:photo')
      await expect(fs.promises.readFile(screenImagePath(hall.id, screen.id), 'utf8')).resolves.toBe('hall-before')
      const kitchenRecord = await database.getRepository(DeviceScreen).findOneByOrFail({ device: { id: kitchen.id }, screen: { id: screen.id } })
      const hallRecord = await database.getRepository(DeviceScreen).findOneByOrFail({ device: { id: hall.id }, screen: { id: screen.id } })
      expect(kitchenRecord.generatedAt.getTime()).toBeGreaterThan(before.getTime())
      expect(hallRecord.generatedAt).toEqual(before)
    })
  })
})
