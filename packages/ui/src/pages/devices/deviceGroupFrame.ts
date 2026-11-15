import type { DeviceGroup, GroupScreen } from 'kuroshiro-shared'
import type { ComputedRef, InjectionKey } from 'vue'
import type { Load } from '@/patterns/useLoad'
import { inject, provide } from 'vue'

/** What the Device Group frame hands the pages under it. */
export interface DeviceGroupFrame {
  /** The Group of the route, loaded once for its pages and kept fresh. After a write that changes it, call its `reload()`. */
  group: Load<DeviceGroup>
  /** The Group's Screens in Order with every member's state, kept fresh. After a write to a Screen, call its `reload()`. */
  screens: Load<GroupScreen[]>
  /** The Group's name, or "Device Group" until it has loaded. */
  name: ComputedRef<string>
  /** The Group's page, which the paths of its other pages start with. */
  path: ComputedRef<string>
}

const deviceGroupFrameKey: InjectionKey<DeviceGroupFrame> = Symbol('Device Group frame')

export function provideDeviceGroupFrame(frame: DeviceGroupFrame) {
  provide(deviceGroupFrameKey, frame)
}

export function useDeviceGroupFrame() {
  const frame = inject(deviceGroupFrameKey)
  if (!frame)
    throw new Error('A Device Group page stands under the Device Group frame: make its route a child of `/device-groups/:groupId`.')
  return frame
}
