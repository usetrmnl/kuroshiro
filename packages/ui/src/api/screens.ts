import type { AssignPluginInput, CreateMashupInput, CreateScreenInput, GroupScreen, ReorderScreensInput, ScheduleInput, ScreenOwner, ScreenRead, SetPickedScreenInput, UpdateMashupInput, UpdateScreenInput } from 'kuroshiro-shared'
import { apiGet, apiSend, apiSendForImage, asUpload } from './client'

/** The Screens a Device shows in Order, each with its Screen State: its Device Group's while it is a member, its own otherwise. */
export function listScreens(deviceId: string) {
  return apiGet<ScreenRead[]>(`devices/${deviceId}/screens`)
}

/** A Device's own Screens in Order: what `listScreens` answers for a Device in no Group, and the parked ones for a member, with no Screen State. */
export function listOwnScreens(deviceId: string) {
  return apiGet<ScreenRead[]>(`devices/${deviceId}/screens/own`)
}

export function reorderScreens(deviceId: string, input: ReorderScreensInput) {
  return apiSend<ScreenRead[]>('PUT', `devices/${deviceId}/screens/order`, input)
}

/** "Show next": refused with `picked-screen-wrong-device`, `picked-screen-mirrored`, `picked-screen-active` or `picked-screen-ineligible`. Answers every Screen of the Device, whose Up next it has just moved. */
export function setPickedScreen(deviceId: string, input: SetPickedScreenInput) {
  return apiSend<ScreenRead[]>('PUT', `devices/${deviceId}/picked-screen`, input)
}

/** "Back to Order": idempotent, whether or not a pick was set. */
export function clearPickedScreen(deviceId: string) {
  return apiSend<ScreenRead[]>('DELETE', `devices/${deviceId}/picked-screen`)
}

/** A Screen as its owner reads it: with its Device's state, or, on a Device Group, with every member's. */
export type OwnedScreen = ScreenRead | GroupScreen

/** Refused with `screen-field-not-for-kind` for a field the Screen's kind does not have, and with `image-fetch-failed` when a kept image's new address gives no image; the earlier image and address then stay. */
export function updateScreen(screenId: string, input: UpdateScreenInput) {
  return apiSend<OwnedScreen>('PATCH', `screens/${screenId}`, input)
}

/**
 * Adds an External link or an HTML Screen at the end of the owner's Order; the Active Screen stays. A kept External link
 * is fetched first and refused with `image-fetch-failed` or `image-unreadable`, and no Screen is added.
 */
export function createScreen(input: Exclude<CreateScreenInput, { kind: 'file' }>) {
  return apiSend<OwnedScreen>('POST', 'screens', input)
}

/** Adds a File Screen from an image. Refused with `image-unreadable`, `upload-too-large` or `demo-mode`. */
export function createFileScreen(input: Omit<Extract<CreateScreenInput, { kind: 'file' }>, 'kind'>, file: File) {
  const { dither, owner, ...text } = input
  return apiSend<OwnedScreen>('POST', 'screens', asUpload(file, {
    'kind': 'file',
    ...text,
    'owner[kind]': owner.kind,
    'owner[id]': owner.id,
    ...(dither !== undefined && { dither: String(dither) }),
  }))
}

/** Adds a Mashup Screen with one Plugin per slot of the layout, in slot order. A Plugin fills one slot at most. */
export function createMashup(input: CreateMashupInput) {
  return apiSend<OwnedScreen>('POST', 'mashup', input)
}

/** Adds the Plugin's Screen at the end of the owner's Order. Refused with `plugin-already-assigned`. */
export function assignPlugin(pluginId: string, input: AssignPluginInput) {
  return apiSend<OwnedScreen>('POST', `plugins/${pluginId}/assign`, input)
}

/** The file converted as the Screen's Device would show it. Nothing is stored. Refused with `image-unreadable`, `upload-too-large` or `demo-mode`. */
export function previewScreenImage(screenId: string, file: File) {
  return apiSendForImage('POST', `screens/${screenId}/image-preview`, asUpload(file))
}

/** Replaces a File Screen's image; the Screen keeps its id, name, Order and Schedule. Refused like the preview. */
export function replaceScreenImage(screenId: string, file: File) {
  return apiSend<OwnedScreen>('PUT', `screens/${screenId}/image`, asUpload(file))
}

/** Fetches a kept External link image again. Refused with `image-fetch-failed`, and the earlier image stays. */
export function refreshScreen(screenId: string) {
  return apiSend<OwnedScreen>('POST', `screens/${screenId}/refresh`)
}

/** Deletes any Screen but a Plugin Screen, which is unassigned. The Screens after it move up in the Order. */
export function deleteScreen(screenId: string) {
  return apiSend('DELETE', `screens/${screenId}`)
}

/** Takes the whole slot list of the Mashup Screen, in slot order, with or without another layout. */
export function updateMashup(screenId: string, input: UpdateMashupInput) {
  return apiSend<OwnedScreen>('PATCH', `mashup/${screenId}`, input)
}

/** Removes the Plugin's Screen from the Device or the Device Group; the Plugin itself stays. */
export function unassignPlugin(pluginId: string, owner: ScreenOwner) {
  return apiSend('DELETE', owner.kind === 'device' ? `plugins/${pluginId}/assignments/${owner.id}` : `plugins/${pluginId}/assignments/device-groups/${owner.id}`)
}

/** Gives the Screen a Schedule and answers the Screen with the Screen State that follows. Refused with `schedule-exists`. */
export function createSchedule(screenId: string, input: ScheduleInput) {
  return apiSend<OwnedScreen>('POST', `screens/${screenId}/schedule`, input)
}

/** Takes only what changed; `null` clears a pair of hours or dates. Half a pair, or a first day after the last, is refused with `validation`. */
export function updateSchedule(screenId: string, input: ScheduleInput) {
  return apiSend<OwnedScreen>('PATCH', `screens/${screenId}/schedule`, input)
}

/** The Screen is always shown again. */
export function removeSchedule(screenId: string) {
  return apiSend<OwnedScreen>('DELETE', `screens/${screenId}/schedule`)
}
