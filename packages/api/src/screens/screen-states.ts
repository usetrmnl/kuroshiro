import type { RenderSignal } from 'kuroshiro-shared'
import type { Device } from '../devices/devices.entity.js'
import type { RotationScreen, ScreenStateRead } from '../schedule/rotation.js'
import type { DeviceScreen } from './device-screen.entity.js'
import { nextRotationAt } from '../devices/next-poll.js'
import { screenStatesOf } from '../schedule/rotation.js'

/**
 * The Render Signal a Screen is gated on before it renders, by Rotation and by
 * "Show next" alike: a `plugin` or Mashup Screen's verdict is remembered until
 * its cached output changes, so Rotation's pure pick (ADR-0031) passes over a
 * remembered `skip` and serves a remembered `hold`'s stored image without
 * launching Chrome; a raw `html` Screen re-evaluates its Render Signal on every
 * poll it comes up in, so a stale stored `skip` or `hold` never gates it.
 */
export function gatingRenderSignalOf(record: DeviceScreen): RenderSignal | null {
  return record.screen.type === 'html' ? null : (record.renderSignal ?? null)
}

/**
 * The Render Signal a read shows for the Screen: its gating one, except that
 * the Active Screen keeps the verdict of the poll that made it Active, which
 * is what the Device shows now — an `html` Screen that raised `hold` still
 * reads "holding image".
 */
export function renderSignalOf(record: DeviceScreen): RenderSignal | null {
  return record.isActive ? (record.renderSignal ?? null) : gatingRenderSignalOf(record)
}

/**
 * The Screen State of each of a Device's Screens, by Screen id, for every read
 * that shows one. `recordsInOrder` is the Device's record of each of its
 * Screens, in the Screens' Order, each with its Screen and the Screen's Schedule.
 */
export function screenStatesOfDevice(device: Device, recordsInOrder: DeviceScreen[], now: Date): Map<string, ScreenStateRead> {
  return screenStatesOf(rotationScreensOf(recordsInOrder), { now, nextRotationAt: nextRotationAt(device, now), isMirrored: !!device.mirrorEnabled, pickedScreenId: device.pickedScreen?.id ?? null })
}

/** What Rotation looks at on each of a Device's Screens: the Screen's id and Schedule, the record's Active mark and gating Render Signal. */
export function rotationScreensOf(recordsInOrder: DeviceScreen[]): RotationScreen[] {
  return recordsInOrder.map(record => rotationScreenOf(record))
}

export function rotationScreenOf(record: DeviceScreen): RotationScreen {
  return { id: record.screen.id, isActive: record.isActive, schedule: record.screen.schedule, renderSignal: gatingRenderSignalOf(record) }
}
