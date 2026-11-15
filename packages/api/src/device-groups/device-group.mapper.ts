import type { DeviceGroupMember, DeviceGroup as DeviceGroupRead, DeviceGroupSummary } from 'kuroshiro-shared'
import type { Device } from '../devices/devices.entity.js'
import type { DeviceGroup } from './device-group.entity.js'

function toDeviceGroupMember(device: Device): DeviceGroupMember {
  return {
    id: device.id,
    name: device.name,
    friendlyId: device.friendlyId,
    deviceModelName: device.deviceModel?.name ?? null,
    paletteName: device.palette?.name ?? null,
  }
}

export function toDeviceGroup(group: DeviceGroup, members: Device[]): DeviceGroupRead {
  return { id: group.id, name: group.name, members: members.map(toDeviceGroupMember) }
}

export function toDeviceGroupSummary(group: DeviceGroup, counts: { memberCount: number, screenCount: number }): DeviceGroupSummary {
  return { id: group.id, name: group.name, memberCount: counts.memberCount, screenCount: counts.screenCount }
}
