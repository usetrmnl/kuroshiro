import type { DeviceDetail, DeviceModelReference } from './devices.ts'
import type { RenderSignal, ScreenRead, ScreenState, ScreenStateCause } from './screens.ts'

export interface DeviceGroupSummary {
  id: string
  name: string
  memberCount: number
  screenCount: number
}

export interface DeviceGroupMember {
  id: string
  name: string
  friendlyId: string
  deviceModel: DeviceModelReference | null
  palette: DeviceDetail['palette']
}

export interface DeviceGroup {
  id: string
  name: string
  members: DeviceGroupMember[]
}

export interface CreateDeviceGroupInput {
  /** Non-empty after trim; unique among Device Groups. */
  name: string
}

export interface UpdateDeviceGroupInput {
  name?: string
}

/** What a Group Screen is to one member Device. */
export interface GroupScreenDeviceState {
  deviceId: string
  isActive: boolean
  /** `null` for a mirrored member, and for a Screen waiting its turn. */
  state: ScreenState | null
  stateCause: ScreenStateCause | null
  picked: boolean
  renderSignal: RenderSignal | null
  /** When the member's record of the Screen was last rendered or converted; `null` before the member's first contact. */
  generatedAt: string | null
  /** The Screen as rendered for this member; `null` until it has been. */
  imagePath: string | null
  renderedAt: string | null
}

/** A Screen of a Device Group: the Screen read model without any one Device's state, plus every member's. */
export interface GroupScreen extends Omit<ScreenRead, 'deviceId' | 'readOnly' | 'state' | 'stateCause' | 'picked' | 'renderSignal' | 'imagePath' | 'renderedAt'> {
  deviceGroupId: string
  perDevice: GroupScreenDeviceState[]
}
