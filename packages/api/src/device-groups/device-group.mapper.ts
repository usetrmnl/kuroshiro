import type { DeviceGroupMember, DeviceGroup as DeviceGroupRead, DeviceGroupSummary } from 'kuroshiro-shared'
import type { Device } from '../devices/devices.entity.js'
import type { DeviceGroup } from './device-group.entity.js'

function toDeviceGroupMember(device: Device): DeviceGroupMember {
  return {
    id: device.id,
    name: device.name,
    friendlyId: device.friendlyId,
    deviceModel: device.deviceModel
      ? { name: device.deviceModel.name, label: device.deviceModel.label, width: device.deviceModel.width, height: device.deviceModel.height, deprecated: device.deviceModel.deprecated }
      : null,
    palette: device.palette ? { id: device.palette.id, name: device.palette.name, kind: device.palette.kind } : null,
  }
}

export function toDeviceGroup(group: DeviceGroup, members: Device[]): DeviceGroupRead {
  return { id: group.id, name: group.name, members: members.map(toDeviceGroupMember) }
}

export function toDeviceGroupSummary(group: DeviceGroup, counts: { memberCount: number, screenCount: number }): DeviceGroupSummary {
  return { id: group.id, name: group.name, memberCount: counts.memberCount, screenCount: counts.screenCount }
}
