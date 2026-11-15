import type { ScreenOwner } from 'kuroshiro-shared'
import type { FindOptionsWhere } from 'typeorm'
import type { Device } from '../devices/devices.entity.js'
import type { Screen } from './screens.entity.js'

/** The `where` that selects the Screens an owner owns. */
export function ownedBy(owner: ScreenOwner): FindOptionsWhere<Screen> {
  return owner.kind === 'device' ? { device: { id: owner.id } } : { deviceGroup: { id: owner.id } }
}

/** The relation to set on a new Screen so that the owner owns it. */
export function ownerRelation(owner: ScreenOwner): Pick<Screen, 'device' | 'deviceGroup'> {
  return owner.kind === 'device' ? { device: { id: owner.id } as Device, deviceGroup: null } : { device: null, deviceGroup: { id: owner.id } as Screen['deviceGroup'] }
}

/** Who owns a Screen loaded with its `device` and `deviceGroup` relations. */
export function ownerOfScreen(screen: Pick<Screen, 'device' | 'deviceGroup'>): ScreenOwner {
  return screen.deviceGroup ? { kind: 'deviceGroup', id: screen.deviceGroup.id } : { kind: 'device', id: screen.device!.id }
}

/** Whose Screens a Device shows: its Device Group's when it is a member, its own otherwise. */
export function shownOwnerOf(device: Pick<Device, 'id' | 'deviceGroup'>): ScreenOwner {
  return device.deviceGroup ? { kind: 'deviceGroup', id: device.deviceGroup.id } : { kind: 'device', id: device.id }
}

/** The `owner` of a request body, or the Device owner that the deprecated `deviceId` names. */
export function ownerOfRequest(body: { owner?: ScreenOwner, deviceId?: string }): ScreenOwner | null {
  if (body.owner)
    return body.owner
  return body.deviceId ? { kind: 'device', id: body.deviceId } : null
}
