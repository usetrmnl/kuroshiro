import type { ScreenOwner } from 'kuroshiro-shared'
import type { DeepPartial, EntityManager } from 'typeorm'
import { DeviceScreen } from './device-screen.entity.js'
import { ownedBy, ownerRelation } from './screen-owner.js'
import { Screen } from './screens.entity.js'

type NewScreen = Omit<DeepPartial<Screen>, 'device' | 'deviceGroup' | 'order'>

async function screensInOrder(manager: EntityManager, owner: ScreenOwner): Promise<Screen[]> {
  return manager.getRepository(Screen).find({ where: ownedBy(owner), order: { order: 'ASC' } })
}

const OWNER_TABLE: Record<ScreenOwner['kind'], string> = { device: 'device', deviceGroup: 'device_group' }

/**
 * How every new Screen enters an owner's Order, whatever its kind: last in the
 * Order. A Device's own Screen also gets its record for the Device, not the
 * Active Screen, so adding never changes what the Device shows; a Group's
 * Screen gets its records when a member first meets it.
 *
 * Locks the owner's row for the rest of the (possibly just-opened)
 * transaction first, so two concurrent adds to the same owner read the
 * maximum Order one after the other instead of both reading it before
 * either writes, which would give both Screens the same Order.
 */
export async function joinEndOfOrder(manager: EntityManager, owner: ScreenOwner, screen: NewScreen): Promise<Screen> {
  return manager.transaction(async (manager) => {
    await manager.query(`SELECT 1 FROM "${OWNER_TABLE[owner.kind]}" WHERE "id" = $1 FOR UPDATE`, [owner.id])
    const screens = manager.getRepository(Screen)
    const lastOrder = await screens.maximum('order', ownedBy(owner)) ?? 0
    const saved = await screens.save(screens.create({
      fetchManual: false,
      ...screen,
      ...ownerRelation(owner),
      order: lastOrder + 1,
    }))
    if (owner.kind === 'device')
      await manager.getRepository(DeviceScreen).insert({ device: { id: owner.id }, screen: { id: saved.id }, isActive: false, generatedAt: new Date() })
    return saved
  })
}

/** Numbers the given Screens 1..N in the sequence they come in, writing only the ones that moved. */
export async function writeOrder(manager: EntityManager, screens: Screen[]): Promise<void> {
  const moved = screens.flatMap((screen, index) => screen.order === index + 1 ? [] : [{ id: screen.id, order: index + 1 }])
  await Promise.all(moved.map(({ id, order }) => manager.getRepository(Screen).update({ id }, { order })))
}

/** Closes the gap a removed Screen left in an owner's Order. */
export async function closeGapInOrder(manager: EntityManager, owner: ScreenOwner): Promise<void> {
  await writeOrder(manager, await screensInOrder(manager, owner))
}
