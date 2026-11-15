import type { DeviceDetail, DeviceGroup, ScreenBody, ScreenOwner } from 'kuroshiro-shared'
import type { ComputedRef, InjectionKey } from 'vue'
import { inject, provide } from 'vue'

/** The Device whose Device Model and Palette an image is converted and previewed for. */
export type RenderTarget = Pick<DeviceDetail, 'id' | 'name' | 'deviceModel' | 'palette'>

/** Who a Screen is added to and edited on: a Device, or a Device Group whose members all show it (ADR-0078). */
export interface ScreenTarget {
  owner: ScreenOwner
  name: string
  /** What previews and "converted for" draw for: the Device itself, or the Group's first member. A Group with no member has none. */
  rendersAs: RenderTarget | undefined
}

export function deviceTarget(device: DeviceDetail): ScreenTarget {
  return { owner: { kind: 'device', id: device.id }, name: device.name, rendersAs: device }
}

export function groupTarget(group: DeviceGroup): ScreenTarget {
  const [first] = group.members
  return {
    owner: { kind: 'deviceGroup', id: group.id },
    name: group.name,
    rendersAs: first && { id: first.id, name: first.name, deviceModel: first.deviceModel, palette: first.palette },
  }
}

/** What Edit HTML needs of a Screen. */
export type HtmlEditable = Pick<ScreenBody, 'id' | 'kind' | 'name' | 'html' | 'dither'>

/** What the frame of a Device or of a Device Group hands the pages that add and edit its Screens. */
export interface ScreenTargetFrame {
  /** The target once its owner has loaded. */
  target: ComputedRef<ScreenTarget | undefined>
  /** The owner's name, known before it has loaded where the Devices list has it. */
  name: ComputedRef<string>
  /** The path of the owner's Screens view, which the paths of Add Screen and Edit HTML start with. */
  path: ComputedRef<string>
  /** Whether the owner is still loading, and why it could not load. */
  waiting: ComputedRef<boolean>
  failure: ComputedRef<{ reason: string } | undefined>
  /** Reads the owner again, after a write that changes what it counts. */
  reload: () => Promise<void>
  /** The owner's Screens, for Edit HTML. */
  listScreens: () => Promise<HtmlEditable[]>
}

const screenTargetKey: InjectionKey<ScreenTargetFrame> = Symbol('Screen target')

export function provideScreenTarget(frame: ScreenTargetFrame) {
  provide(screenTargetKey, frame)
}

export function useScreenTarget() {
  const frame = inject(screenTargetKey)
  if (!frame)
    throw new Error('A page that adds or edits Screens stands under the frame of a Device or of a Device Group.')
  return frame
}

export const addScreenPathOf = (ownerPath: string) => `${ownerPath}/screens/new`

export const editHtmlPathOf = (ownerPath: string, screenId: string) => `${ownerPath}/screens/${screenId}/html`
