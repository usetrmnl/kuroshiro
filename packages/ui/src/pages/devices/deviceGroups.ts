import type { DeviceGroup, DeviceGroupMember, DeviceGroupSummary, DeviceSummary, GroupScreen, GroupScreenDeviceState, ScreenState } from 'kuroshiro-shared'
import type { SelectOption } from '@/components/selectOption'
import { SCREEN_STATE_LABELS } from '@/components/screenRows'
import { possessive } from './screenNaming'

/** What is wrong with a Group's name as entered, or nothing. */
export const groupNameProblem = (name: string) => name.trim() === '' ? 'A Device Group needs a name.' : undefined

const devicesCounted = (count: number) => `${count} ${count === 1 ? 'Device' : 'Devices'}`

export const screensCounted = (count: number) => `${count} ${count === 1 ? 'Screen' : 'Screens'}`

/** The line under a Group's name in the Devices list: "2 Devices · 5 Screens". */
export const groupFacts = ({ memberCount, screenCount }: DeviceGroupSummary) => `${devicesCounted(memberCount)} · ${screensCounted(screenCount)}`

/** "TRMNL OG (2-bit) · Greyscale, 4 levels", or what the member has of the two. Empty for a Device with neither. */
export function memberFacts(member: DeviceGroupMember) {
  return [member.deviceModel?.label, member.palette?.name].filter(Boolean).join(' · ')
}

/**
 * The Devices that can join the Group, as a select offers them: every Device that is not already in it, by name.
 * One in another Group says so, since joining here takes it out of there.
 */
export function joinCandidates(devices: DeviceSummary[], group: Pick<DeviceGroup, 'id'>): SelectOption[] {
  return devices
    .filter(device => device.deviceGroup?.id !== group.id)
    .map(device => ({ value: device.id, label: device.deviceGroup ? `${device.name} · in ${device.deviceGroup.name}` : device.name }))
}

/** What joining does to the Device, said under the picker; a Device coming from another Group leaves it. */
export function joinNote(groupName: string, from?: { name: string }) {
  const parked = `Its own Screens are parked while it is in ${groupName} and come back when it leaves.`
  const starts = `It starts ${possessive(groupName)} Order from the first Screen.`
  return from ? `It leaves ${from.name}. ${parked} ${starts}` : `${parked} ${starts}`
}

export interface MemberStateWords {
  /** The member's Screen State as the row words it; empty while the Screen waits its turn there. */
  words: string
  qualifier?: string
}

/** One member's Screen State on a Group Screen, with its qualifiers: the Picked Screen and the `hold` Render Signal. */
export function memberStateWords({ state, picked, renderSignal }: Pick<GroupScreenDeviceState, 'state' | 'picked' | 'renderSignal'>): MemberStateWords {
  const holding = renderSignal === 'hold'
  if (state === null)
    return { words: holding ? 'Holding image' : '' }
  const qualifiers = [state === 'upNext' && picked ? 'picked by hand' : undefined, holding ? 'holding image' : undefined].filter(Boolean)
  return { words: SCREEN_STATE_LABELS[state], qualifier: qualifiers.length > 0 ? qualifiers.join(' · ') : undefined }
}

/** The members that have a Screen State on the Screen, each worded with its name: "Kitchen: Active Screen". */
export function memberChips(screen: Pick<GroupScreen, 'perDevice'>, members: Pick<DeviceGroupMember, 'id' | 'name'>[]) {
  return screen.perDevice.flatMap((state) => {
    const member = members.find(candidate => candidate.id === state.deviceId)
    const worded = memberStateWords(state)
    return member && worded.words ? [{ deviceId: member.id, text: `${member.name}: ${worded.words}` }] : []
  })
}

const ROW_STATES: ScreenState[] = ['active', 'upNext']

/** The one state the row's look follows: Active Screen where any member shows it, Up next where any member turns to it next. */
export function rowStateOf(screen: Pick<GroupScreen, 'perDevice'>): ScreenState | null {
  return ROW_STATES.find(state => screen.perDevice.some(member => member.state === state)) ?? null
}

/** The first member's rendered image, for the row's thumbnail. */
export function thumbnailOf(screen: Pick<GroupScreen, 'perDevice'>) {
  return screen.perDevice.find(member => member.imagePath !== null) ?? null
}

/** The newest of the members' renders, for "last rendered". */
export function newestRenderOf(screen: Pick<GroupScreen, 'perDevice'>) {
  return screen.perDevice.map(member => member.renderedAt).filter((at): at is string => at !== null).sort().at(-1) ?? null
}

export function deleteGroupWording(group: Pick<DeviceGroup, 'name' | 'members'>, screenCount: number) {
  return {
    title: `Delete ${group.name}?`,
    lost: `${group.name} and its ${screensCounted(screenCount)} with their Schedules.`,
    stays: group.members.length === 0
      ? 'Every Device; none is in this Group.'
      : `${group.members.map(member => member.name).join(', ')}: ${group.members.length === 1 ? 'it' : 'each'} shows its own Screens again, from the first in its Order.`,
  }
}

export function leaveGroupWording(member: Pick<DeviceGroupMember, 'name'>, group: Pick<DeviceGroup, 'name'>) {
  return {
    title: `Take ${member.name} out of ${group.name}?`,
    sentence: `${member.name} shows its own Screens again, from the first in its Order. Nothing is deleted.`,
  }
}
