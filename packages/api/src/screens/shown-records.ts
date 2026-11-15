import type { FindOptionsRelations, Repository } from 'typeorm'
import type { Device } from '../devices/devices.entity.js'
import type { Screen } from './screens.entity.js'
import { In } from 'typeorm'
import { DeviceScreen } from './device-screen.entity.js'
import { ownedBy, shownOwnerOf } from './screen-owner.js'

const NEVER = new Date(0)

/**
 * A Device's record of each Screen it shows (its Device Group's when it is a
 * member, its own otherwise), in the Screens' Order, each with the Screen and
 * the Screen's Schedule. A Group Screen the Device has not met yet has no
 * record (ADR-0078): `create` writes it, so the Device's next poll starts the
 * Order from the first Screen; without `create` a read answers a record that
 * is not stored, not Active and never rendered.
 */
export async function shownRecordsOf(
  repos: { screens: Repository<Screen>, records: Repository<DeviceScreen> },
  device: Pick<Device, 'id' | 'deviceGroup'>,
  options: { create: boolean, screenRelations?: FindOptionsRelations<Screen> },
): Promise<DeviceScreen[]> {
  // A Device's own Screens always have their records: adding a Screen writes one.
  if (!device.deviceGroup) {
    return repos.records.find({
      where: { device: { id: device.id } },
      relations: { screen: options.screenRelations ?? { schedule: true } },
      order: { screen: { order: 'ASC' } },
    })
  }
  const screens = await repos.screens.find({ where: ownedBy(shownOwnerOf(device)), relations: options.screenRelations ?? { schedule: true }, order: { order: 'ASC' } })
  if (screens.length === 0)
    return []
  const find = () => repos.records.find({ where: { device: { id: device.id }, screen: { id: In(screens.map(screen => screen.id)) } }, relations: { screen: true } })
  let records = await find()
  const stored = new Set(records.map(record => record.screen.id))
  const missing = screens.filter(screen => !stored.has(screen.id))
  if (missing.length > 0 && options.create) {
    await repos.records.createQueryBuilder().insert().values(missing.map(screen => ({ device: { id: device.id }, screen: { id: screen.id }, isActive: false, generatedAt: new Date() }))).orIgnore().execute()
    records = await find()
  }
  const byScreen = new Map(records.map(record => [record.screen.id, record]))
  return screens.map((screen) => {
    const record = byScreen.get(screen.id) ?? placeholderOf(device, screen)
    record.screen = screen
    return record
  })
}

function placeholderOf(device: Pick<Device, 'id'>, screen: Screen): DeviceScreen {
  return Object.assign(new DeviceScreen(), { id: '', device: { id: device.id } as Device, screen, isActive: false, generatedAt: NEVER, cachedPluginOutput: null, renderSignal: null })
}
