import type { DataSource } from 'typeorm'
import type { PluginExporterService } from '../../plugins/services/plugin-exporter.service.js'
import type { PluginFieldValuesService } from '../../plugins/services/plugin-field-values.service.js'
import type { PluginSchedulerService } from '../../plugins/services/plugin-scheduler.service.js'
import * as fs from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeviceGroup } from '../../device-groups/device-group.entity.js'
import { Palette } from '../../device-models/entities/palette.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { Firmware } from '../../firmware/entities/firmware.entity.js'
import { DevicePlugin } from '../../plugins/entities/device-plugin.entity.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { PluginImporterService } from '../../plugins/services/plugin-importer.service.js'
import { originalImagePath, screenImagePath } from '../../screens/screen-image-paths.js'
import { Screen } from '../../screens/screens.entity.js'
import { InstanceSettings } from '../../settings/entities/instance-settings.entity.js'
import { createMockDeviceModelsService, primeMockDeviceModelsService } from '../../test/mockDeviceModelsService.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { resolveAppPath } from '../../utils/pathHelper.js'
import { CONFIG_SCHEMA_VERSION } from '../schema-version.js'
import { ConfigurationExportService } from '../services/configuration-export.service.js'
import { ConfigurationImportService } from '../services/configuration-import.service.js'
import { buildArchive, makeDeviceEntry } from './archive.js'

vi.mock('../../utils/imageUtils.js', () => ({
  convertToPng: vi.fn(),
}))

const GROUP_ID = '00000000-0000-4000-8000-0000000000a1'
const FILE_SCREEN_ID = '00000000-0000-4000-8000-000000000f01'
const OWN_SCREEN_ID = '00000000-0000-4000-8000-000000000f02'
const KITCHEN_ID = '00000001-0000-4000-8000-000000000001'
const HALL_ID = '00000001-0000-4000-8000-000000000002'

async function writeFile(destination: string, content: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(destination), { recursive: true })
  await fs.promises.writeFile(destination, content)
}

describe('device Groups, through Configuration Export and Import, against a real database', () => {
  let database: DataSource
  let exportService: ConfigurationExportService
  let importService: ConfigurationImportService

  beforeAll(async () => {
    database = await createTestDatabase()
    const deviceModels = createMockDeviceModelsService()
    primeMockDeviceModelsService(deviceModels)
    const pluginExporter = { buildEntries: () => [] } as unknown as PluginExporterService
    const fieldValues = { storedByPlugin: async () => new Map() } as unknown as PluginFieldValuesService
    const scheduler = { schedulePlugin: vi.fn() } as unknown as PluginSchedulerService

    exportService = new ConfigurationExportService(
      database.getRepository(Plugin),
      database.getRepository(Device),
      database.getRepository(Screen),
      database.getRepository(DevicePlugin),
      database.getRepository(Palette),
      database.getRepository(Firmware),
      database.getRepository(InstanceSettings),
      pluginExporter,
      fieldValues,
    )
    importService = new ConfigurationImportService(database.getRepository(Plugin), new PluginImporterService(), scheduler, asService(deviceModels))
  })

  beforeEach(async () => {
    const { convertToPng } = await import('../../utils/imageUtils.js')
    vi.mocked(convertToPng).mockImplementation(async (input, output) => writeFile(output, `converted-from:${await fs.promises.readFile(input, 'utf8')}`))
    await database.synchronize(true)
  })

  afterEach(async () => {
    for (const id of [KITCHEN_ID, HALL_ID, GROUP_ID])
      await fs.promises.rm(resolveAppPath('public', 'screens', 'devices', id), { recursive: true, force: true })
  })

  afterAll(async () => {
    await database.destroy()
  })

  async function seedGroupWithTwoMembers(): Promise<void> {
    const group = await database.getRepository(DeviceGroup).save({ id: GROUP_ID, name: 'Downstairs' })
    for (const [id, mac, friendlyId] of [[KITCHEN_ID, 'AA:BB:CC:DD:EE:01', 'KITCHN'], [HALL_ID, 'AA:BB:CC:DD:EE:02', 'HALLWY']]) {
      await database.getRepository(Device).save({ id, name: friendlyId, friendlyId, mac, apikey: `key-${id}`, refreshRate: 300, deviceGroup: group })
    }
    await database.getRepository(Screen).save({ id: FILE_SCREEN_ID, type: 'file', filename: 'Photo', order: 1, fetchManual: false, deviceGroup: group })
    await database.getRepository(Screen).save({ id: OWN_SCREEN_ID, type: 'html', filename: 'Own', html: '<p>Own</p>', order: 1, fetchManual: false, device: { id: KITCHEN_ID } })
    await writeFile(originalImagePath(GROUP_ID, FILE_SCREEN_ID), 'photo-original')
  }

  it('carries the Groups, owners, memberships and the original of a Group\'s file Screen in an archive of the current version', async () => {
    await seedGroupWithTwoMembers()

    const zip = new AdmZip(await exportService.exportToZip())

    expect(JSON.parse(zip.readAsText('manifest.json'))).toMatchObject({ schemaVersion: CONFIG_SCHEMA_VERSION })
    expect(JSON.parse(zip.readAsText('device-groups.json'))).toEqual([{ id: GROUP_ID, name: 'Downstairs' }])
    expect(JSON.parse(zip.readAsText('devices.json')).map((device: { id: string, deviceGroupId: string }) => [device.id, device.deviceGroupId]).sort()).toEqual([[KITCHEN_ID, GROUP_ID], [HALL_ID, GROUP_ID]])
    const screens: Array<{ id: string, owner: unknown, deviceId: string | null }> = JSON.parse(zip.readAsText('screens.json'))
    expect(screens.find(screen => screen.id === FILE_SCREEN_ID)).toMatchObject({ owner: { kind: 'deviceGroup', id: GROUP_ID }, deviceId: null })
    expect(screens.find(screen => screen.id === OWN_SCREEN_ID)).toMatchObject({ owner: { kind: 'device', id: KITCHEN_ID }, deviceId: KITCHEN_ID })
    expect(zip.readAsText(`screens/${FILE_SCREEN_ID}.original`)).toBe('photo-original')
  })

  it('round-trips Groups, owners, memberships and the original, converted again for each member', async () => {
    await seedGroupWithTwoMembers()
    const archive = await exportService.exportToZip()
    await database.synchronize(true)
    await fs.promises.rm(resolveAppPath('public', 'screens', 'devices', GROUP_ID), { recursive: true, force: true })

    const summary = await importService.importFromZip(archive)

    expect(summary.created).toMatchObject({ deviceGroups: 1, devices: 2, screens: 2 })
    expect(await database.getRepository(DeviceGroup).find()).toEqual([{ id: GROUP_ID, name: 'Downstairs' }])
    const devices = await database.getRepository(Device).find({ order: { friendlyId: 'ASC' } })
    expect(devices.map(device => device.deviceGroup?.id)).toEqual([GROUP_ID, GROUP_ID])
    const screens = await database.getRepository(Screen).find({ relations: { device: true, deviceGroup: true }, order: { filename: 'ASC' } })
    expect(screens.map(screen => [screen.filename, screen.device?.id ?? null, screen.deviceGroup?.id ?? null])).toEqual([['Own', KITCHEN_ID, null], ['Photo', null, GROUP_ID]])
    await expect(fs.promises.readFile(originalImagePath(GROUP_ID, FILE_SCREEN_ID), 'utf8')).resolves.toBe('photo-original')
    for (const deviceId of [KITCHEN_ID, HALL_ID])
      await expect(fs.promises.readFile(screenImagePath(deviceId, FILE_SCREEN_ID), 'utf8')).resolves.toBe('converted-from:photo-original')
  })

  it('imports a schemaVersion 7 archive with every Screen Device-owned and its converted image as it stands', async () => {
    const archive = buildArchive({
      manifest: { kuroshiroVersion: '0.40.0', schemaVersion: 7, exportedAt: new Date().toISOString(), containsSecrets: true },
      devices: [makeDeviceEntry({ id: KITCHEN_ID })],
      screens: [{ id: FILE_SCREEN_ID, deviceId: KITCHEN_ID, type: 'file', order: 1, filename: 'Photo', externalLink: null, html: null, fetchManual: false, pluginId: null, devicePluginId: null, schedule: null, mashupConfiguration: null }],
      screenImages: { [FILE_SCREEN_ID]: 'old-converted' },
    })

    const summary = await importService.importFromZip(archive)

    expect(summary.created).toMatchObject({ devices: 1, screens: 1 })
    expect(summary.created.deviceGroups).toBeUndefined()
    const screen = await database.getRepository(Screen).findOneOrFail({ where: { id: FILE_SCREEN_ID }, relations: { device: true, deviceGroup: true } })
    expect(screen.device?.id).toBe(KITCHEN_ID)
    expect(screen.deviceGroup).toBeNull()
    await expect(fs.promises.readFile(screenImagePath(KITCHEN_ID, FILE_SCREEN_ID), 'utf8')).resolves.toBe('old-converted')
  })

  it('reports the schemaVersion of an archive of the current version in its check', async () => {
    const archive = buildArchive({ deviceGroups: [{ id: GROUP_ID, name: 'Downstairs' }] })

    const check = await importService.checkZip(archive)

    expect(check.archive.schemaVersion).toBe(CONFIG_SCHEMA_VERSION)
    expect(check.adds).toMatchObject({ deviceGroups: 1 })
    expect(await database.getRepository(DeviceGroup).count()).toBe(0)
  })
})
