import type { DeviceGroup, DeviceGroupMember, DeviceGroupSummary, GroupScreen, GroupScreenDeviceState } from 'kuroshiro-shared'
import { defineBuilder } from './defineBuilder'
import { buildScreen } from './screens'

export const buildDeviceGroupSummary = defineBuilder<DeviceGroupSummary>(() => ({
  id: 'b7e2a4c0-6f1d-4e3b-9a8c-2d5f7e9b1c3a',
  name: 'Downstairs',
  memberCount: 2,
  screenCount: 3,
}))

export const buildDeviceGroupMember = defineBuilder<DeviceGroupMember>(() => ({
  id: '3f6c1c1e-9d0a-4f39-8a53-0c2f0a1d7b11',
  name: 'Kitchen',
  friendlyId: '4F2A1C',
  deviceModel: { name: 'og_plus', label: 'TRMNL OG (2-bit)', width: 800, height: 480, deprecated: false },
  palette: { id: '5c9e2f7a-3b1d-4e8f-a6c4-0d2b7e9f1a3c', name: 'Greyscale, 4 levels', kind: 'official' },
}))

export const buildDeviceGroup = defineBuilder<DeviceGroup>(() => ({
  id: 'b7e2a4c0-6f1d-4e3b-9a8c-2d5f7e9b1c3a',
  name: 'Downstairs',
  members: [
    buildDeviceGroupMember(),
    buildDeviceGroupMember({ id: '8c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e60', name: 'Hallway', friendlyId: '9B3D2E' }),
  ],
}))

export const buildGroupScreenDeviceState = defineBuilder<GroupScreenDeviceState>(() => ({
  deviceId: '3f6c1c1e-9d0a-4f39-8a53-0c2f0a1d7b11',
  isActive: false,
  state: null,
  stateCause: null,
  picked: false,
  renderSignal: null,
  generatedAt: '2026-10-03T07:31:00.000Z',
  imagePath: '/screens/devices/3f6c1c1e-9d0a-4f39-8a53-0c2f0a1d7b11/c2f1d0a4-5b6e-4c7d-8e9f-0a1b2c3d4e5f.png?v=1791012660000',
  renderedAt: '2026-10-03T07:31:00.000Z',
}))

/** A Group Screen: the Screen's body with every member's state, none of them showing it unless overridden. */
export const buildGroupScreen = defineBuilder<GroupScreen>(() => {
  const { deviceId, readOnly, state, stateCause, picked, renderSignal, imagePath, renderedAt, ...body } = buildScreen()
  return {
    ...body,
    deviceGroupId: 'b7e2a4c0-6f1d-4e3b-9a8c-2d5f7e9b1c3a',
    perDevice: [
      buildGroupScreenDeviceState(),
      buildGroupScreenDeviceState({ deviceId: '8c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e60', imagePath: null, renderedAt: null, generatedAt: null }),
    ],
  }
})
