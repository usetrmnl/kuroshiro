import { resolveAppPath } from '../utils/pathHelper.js'

/** Where the converted image of a Screen for a Device lives; keyed by both, so a Screen shown by several Devices keeps one per Device. */
export function screenImagePath(deviceId: string, screenId: string): string {
  return resolveAppPath('public', 'screens', 'devices', deviceId, `${screenId}.png`)
}

/** The public path under the API's origin that serves `screenImagePath`. */
export function screenImageUrlPath(deviceId: string, screenId: string): string {
  return `/screens/devices/${deviceId}/${screenId}.png`
}

/** A File Screen's retained original, keyed by its owner (the Device for now) and the Screen. */
export function originalImagePath(ownerId: string, screenId: string): string {
  return resolveAppPath('public', 'screens', 'devices', ownerId, `${screenId}.original`)
}

/** The URL a Device fetches the converted image of a Screen at. */
export function screenImageUrl(apiUrl: string, deviceId: string, screenId: string): string {
  return `${apiUrl}${screenImageUrlPath(deviceId, screenId)}`
}
