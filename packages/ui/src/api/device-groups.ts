import type { CreateDeviceGroupInput, DeviceGroup, DeviceGroupSummary, GroupScreen, ReorderScreensInput, UpdateDeviceGroupInput } from 'kuroshiro-shared'
import { apiGet, apiSend } from './client'

/** Every Device Group by name, each with how many Devices and Screens it has. */
export function listDeviceGroups() {
  return apiGet<DeviceGroupSummary[]>('device-groups')
}

export function getDeviceGroup(groupId: string) {
  return apiGet<DeviceGroup>(`device-groups/${groupId}`)
}

/** Refused with `device-group-name-taken`. */
export function createDeviceGroup(input: CreateDeviceGroupInput) {
  return apiSend<DeviceGroup>('POST', 'device-groups', input)
}

/** Refused with `device-group-name-taken`. */
export function updateDeviceGroup(groupId: string, input: UpdateDeviceGroupInput) {
  return apiSend<DeviceGroup>('PATCH', `device-groups/${groupId}`, input)
}

/** Every member leaves and gets its own Screens back; the Group's Screens are deleted with it. */
export function deleteDeviceGroup(groupId: string) {
  return apiSend('DELETE', `device-groups/${groupId}`)
}

/** The Group's Screens in Order, each with every member's Screen State. */
export function listGroupScreens(groupId: string) {
  return apiGet<GroupScreen[]>(`device-groups/${groupId}/screens`)
}

export function reorderGroupScreens(groupId: string, input: ReorderScreensInput) {
  return apiSend<GroupScreen[]>('PUT', `device-groups/${groupId}/screens/order`, input)
}
