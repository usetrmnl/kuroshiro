import type { ConfigService } from '@nestjs/config'
import type { DataSource } from 'typeorm'
import type { DeviceModelsService } from '../../../device-models/device-models.service.js'
import type { FallbackScreensService } from '../../../device-models/fallback-screens.service.js'
import type { FirmwareService } from '../../../firmware/firmware.service.js'
import type { ScreenRenderService } from '../../../mashup/services/screen-render.service.js'
import type { PluginRendererService } from '../../../plugins/services/plugin-renderer.service.js'
import * as fs from 'node:fs'
import path from 'node:path'
import { CONFIGURATION_REDACTION_SENTINEL } from 'kuroshiro-shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeviceGroup } from '../../../device-groups/device-group.entity.js'
import { DeviceModelSyncService } from '../../../device-models/device-model-sync.service.js'
import { DeviceModel } from '../../../device-models/entities/device-model.entity.js'
import { Palette } from '../../../device-models/entities/palette.entity.js'
import { DeviceSensorsService } from '../../../device-sensors/device-sensors.service.js'
import { DeviceSensor } from '../../../device-sensors/entities/device-sensor.entity.js'
import { Device } from '../../../devices/devices.entity.js'
import { DeviceDisplayService } from '../../../devices/display.service.js'
import { DevicePlugin } from '../../../plugins/entities/device-plugin.entity.js'
import { Plugin } from '../../../plugins/entities/plugin.entity.js'
import { PluginImporterService } from '../../../plugins/services/plugin-importer.service.js'
import { Schedule } from '../../../schedule/schedule.entity.js'
import { DeviceScreen } from '../../../screens/device-screen.entity.js'
import { Screen } from '../../../screens/screens.entity.js'
import { createMockDeviceModelsService, createMockFallbackScreensService, primeMockDeviceModelsService, primeMockFallbackScreensService } from '../../../test/mockDeviceModelsService.js'
import { createPluginTemplateContextService } from '../../../test/mockPluginCollaborators.js'
import { asService } from '../../../test/mockService.js'
import { createTestDatabase } from '../../../test/testDatabase.js'
import { ConfigurationImportService } from '../../services/configuration-import.service.js'
import { buildShowcaseArchiveZip } from '../showcase-archive.js'
import { ShowcaseSeedService } from '../showcase-seed.service.js'

vi.mock('../../../utils/imageUtils.js', () => ({
  convertToPng: vi.fn(),
}))

const API_URL = 'http://api'

describe('the showcase seed, against a real database', () => {
  let database: DataSource
  let scheduler: { schedulePlugin: ReturnType<typeof vi.fn> }
  let configurationImport: ConfigurationImportService
  let deviceModelSync: DeviceModelSyncService
  let service: ShowcaseSeedService
  let displayService: DeviceDisplayService

  beforeAll(async () => {
    database = await createTestDatabase()
  })

  beforeEach(async () => {
    await database.synchronize(true)
    scheduler = { schedulePlugin: vi.fn() }
    const deviceModels = createMockDeviceModelsService()
    primeMockDeviceModelsService(deviceModels)
    const fallbackScreens = createMockFallbackScreensService()
    primeMockFallbackScreensService(fallbackScreens)
    const { convertToPng } = await import('../../../utils/imageUtils.js')
    vi.mocked(convertToPng).mockImplementation(async (input, output) => {
      await fs.promises.mkdir(path.dirname(output), { recursive: true })
      await fs.promises.copyFile(input, output)
    })
    // Only the browser is left out: a rendered Screen is a path where its image would be.
    const screenRender = { renderBodyToScreenPng: async (_body: string, screen: { id: string }, device: { id: string }) => `${API_URL}/rendered/${device.id}/${screen.id}.png`, cachePluginOutput: async () => undefined }
    displayService = new DeviceDisplayService(
      database.getRepository(Device),
      database.getRepository(Screen),
      database.getRepository(DeviceScreen),
      asService<ConfigService>({ get: () => API_URL }),
      asService<DeviceModelsService>(deviceModels),
      asService<FallbackScreensService>(fallbackScreens),
      asService<FirmwareService>({}),
      asService<PluginRendererService>({ render: async () => '<p>rendered</p>' }),
      new DeviceSensorsService(database.getRepository(DeviceSensor)),
      createPluginTemplateContextService(),
      asService<ScreenRenderService>(screenRender),
    )

    configurationImport = new ConfigurationImportService(
      database.getRepository(Plugin),
      new PluginImporterService(),
      asService(scheduler),
      asService(deviceModels),
    )
    deviceModelSync = new DeviceModelSyncService(database.getRepository(DeviceModel), database.getRepository(Palette), asService({}))

    service = new ShowcaseSeedService(
      asService<ConfigService>({ get: () => true }),
      database.getRepository(Device),
      database.getRepository(Plugin),
      deviceModelSync,
      configurationImport,
    )
  })

  afterAll(async () => {
    await database.destroy()
  })

  it('seeds the showcase Device, Screens, Mashup, Schedule and Poll Plugins, and schedules every Plugin', async () => {
    await service.onApplicationBootstrap()

    const devices = await database.getRepository(Device).find()
    expect(devices).toHaveLength(3)
    expect(devices.map(device => device.mac).sort()).toEqual(['DE:AD:BE:EF:00:01', 'DE:AD:BE:EF:00:02', 'DE:AD:BE:EF:00:03'])
    expect(devices.every(device => device.apikey !== CONFIGURATION_REDACTION_SENTINEL)).toBe(true)

    const plugins = await database.getRepository(Plugin).find()
    expect(plugins).toHaveLength(3)
    expect(plugins.every(plugin => plugin.kind === 'Poll')).toBe(true)

    const screens = await database.getRepository(Screen).find()
    expect(screens).toHaveLength(5)
    expect(screens.map(screen => screen.type).sort()).toEqual(['file', 'mashup', 'plugin', 'plugin', 'plugin'])

    expect(await database.getRepository(Schedule).count()).toBe(1)
    expect(await database.getRepository(DevicePlugin).count()).toBe(3)

    expect(scheduler.schedulePlugin).toHaveBeenCalledTimes(3)
  })

  it('seeds a Device Group of two Devices of different Device Models, each served an image from the Group\'s Screens', async () => {
    await service.onApplicationBootstrap()

    const group = await database.getRepository(DeviceGroup).findOneByOrFail({ name: 'Lobby displays' })
    const members = await database.getRepository(Device).find({ where: { deviceGroup: { id: group.id } }, relations: { deviceGroup: true } })
    expect(members.map(member => member.name).sort()).toEqual(['Entrance', 'Reception'])
    const owned = await database.getRepository(Screen).find({ where: { deviceGroup: { id: group.id } }, order: { order: 'ASC' } })
    expect(owned.map(screen => screen.type)).toEqual(['plugin', 'file'])

    for (const member of members) {
      const rendered = new Set<string>()
      // Two polls walk the Group's two Screens: the Plugin Screen, then the File Screen.
      for (let poll = 0; poll < 2; poll++) {
        const display = await displayService.getCurrentImage({ 'id': member.mac, 'access-token': member.apikey })
        rendered.add(display.image_url)
      }
      expect([...rendered].every(url => url.startsWith(`${API_URL}/`) && url.endsWith('.png') && !url.includes('/fallback'))).toBe(true)
      expect(rendered.size).toBe(2)
    }
  })

  it('imports the archive with no device-model or palette warnings, once the Device Model snapshot is seeded', async () => {
    await deviceModelSync.seedFromSnapshot()

    const summary = await configurationImport.importFromZip(buildShowcaseArchiveZip())

    expect(summary.warnings.filter(w => w.kind === 'device-model-unknown' || w.kind === 'palette-unknown')).toEqual([])
  })

  it('does nothing on a second boot, once the first has seeded the database', async () => {
    await service.onApplicationBootstrap()
    const afterFirstBoot = await database.getRepository(Device).find()

    await service.onApplicationBootstrap()

    expect(await database.getRepository(Device).find()).toEqual(afterFirstBoot)
    expect(await database.getRepository(Plugin).count()).toBe(3)
  })

  it('leaves the database empty when demo mode is off', async () => {
    const offService = new ShowcaseSeedService(
      asService<ConfigService>({ get: () => false }),
      database.getRepository(Device),
      database.getRepository(Plugin),
      asService({}),
      asService({}),
    )

    await offService.onApplicationBootstrap()

    expect(await database.getRepository(Device).count()).toBe(0)
  })
})
