import { describe, expect, it } from 'vitest'
import { buildDeviceGroup, buildDeviceGroupMember, buildDeviceGroupSummary, buildGroupScreen, buildGroupScreenDeviceState } from '@/testing/fixtures/device-groups'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { deleteGroupWording, groupFacts, groupNameProblem, joinCandidates, joinNote, leaveGroupWording, memberChips, memberFacts, memberStateWords, newestRenderOf, rowStateOf, thumbnailOf } from '../deviceGroups'

const kitchen = buildDeviceGroupMember({ id: 'kitchen', name: 'Kitchen' })
const hallway = buildDeviceGroupMember({ id: 'hallway', name: 'Hallway', deviceModel: null, palette: null })

describe('a Group\'s name', () => {
  it('needs a name', () => {
    expect(groupNameProblem('   ')).toBe('A Device Group needs a name.')
    expect(groupNameProblem(' Downstairs ')).toBeUndefined()
  })
})

describe('the facts of a Group and of a member', () => {
  it('counts the Devices and the Screens, singular where there is one', () => {
    expect(groupFacts(buildDeviceGroupSummary({ memberCount: 1, screenCount: 1 }))).toBe('1 Device · 1 Screen')
    expect(groupFacts(buildDeviceGroupSummary({ memberCount: 0, screenCount: 3 }))).toBe('0 Devices · 3 Screens')
  })

  it('names a member\'s Device Model and Palette, and nothing for a Device with neither', () => {
    expect(memberFacts(kitchen)).toBe('TRMNL OG (2-bit) · Greyscale, 4 levels')
    expect(memberFacts(hallway)).toBe('')
    expect(memberFacts(buildDeviceGroupMember({ palette: null }))).toBe('TRMNL OG (2-bit)')
  })
})

describe('joining a Group', () => {
  const group = { id: 'downstairs' }
  const devices = [
    buildDeviceSummary({ id: 'kitchen', name: 'Kitchen', deviceGroup: { id: 'downstairs', name: 'Downstairs' } }),
    buildDeviceSummary({ id: 'study', name: 'Study', deviceGroup: null }),
    buildDeviceSummary({ id: 'attic', name: 'Attic', deviceGroup: { id: 'upstairs', name: 'Upstairs' } }),
  ]

  it('offers every Device that is not in the Group, naming the Group one is in', () => {
    expect(joinCandidates(devices, group)).toEqual([
      { value: 'study', label: 'Study' },
      { value: 'attic', label: 'Attic · in Upstairs' },
    ])
  })

  it('says what joining does, and that a Device from another Group leaves it', () => {
    expect(joinNote('Downstairs')).toBe('Its own Screens are parked while it is in Downstairs and come back when it leaves. It starts Downstairs\'s Order from the first Screen.')
    expect(joinNote('Downstairs', { name: 'Upstairs' })).toBe('It leaves Upstairs. Its own Screens are parked while it is in Downstairs and come back when it leaves. It starts Downstairs\'s Order from the first Screen.')
  })
})

describe('a member\'s state on a Group Screen', () => {
  it('words the Screen State with its qualifiers, and nothing for a Screen waiting its turn', () => {
    expect(memberStateWords({ state: 'active', picked: false, renderSignal: null })).toEqual({ words: 'Active Screen', qualifier: undefined })
    expect(memberStateWords({ state: 'upNext', picked: true, renderSignal: 'hold' })).toEqual({ words: 'Up next', qualifier: 'picked by hand · holding image' })
    expect(memberStateWords({ state: null, picked: false, renderSignal: null })).toEqual({ words: '' })
    expect(memberStateWords({ state: null, picked: false, renderSignal: 'hold' })).toEqual({ words: 'Holding image' })
    expect(memberStateWords({ state: 'notToday', picked: false, renderSignal: null })).toEqual({ words: 'Not today', qualifier: undefined })
  })

  it('chips only the members with a state, named, in the members\' order', () => {
    const screen = buildGroupScreen({
      perDevice: [
        buildGroupScreenDeviceState({ deviceId: 'kitchen', state: 'active' }),
        buildGroupScreenDeviceState({ deviceId: 'hallway', state: null }),
        buildGroupScreenDeviceState({ deviceId: 'gone', state: 'upNext' }),
      ],
    })

    expect(memberChips(screen, [kitchen, hallway])).toEqual([{ deviceId: 'kitchen', text: 'Kitchen: Active Screen' }])
  })

  it('gives the row the Active Screen look where any member shows it, Up next where any turns to it, none otherwise', () => {
    const states = (...each: Array<'active' | 'upNext' | 'scheduleOff' | null>) => buildGroupScreen({ perDevice: each.map((state, index) => buildGroupScreenDeviceState({ deviceId: String(index), state })) })

    expect(rowStateOf(states('upNext', 'active'))).toBe('active')
    expect(rowStateOf(states(null, 'upNext'))).toBe('upNext')
    expect(rowStateOf(states('scheduleOff', null))).toBeNull()
  })

  it('takes the first member\'s rendered image for the thumbnail and the newest render for "last rendered"', () => {
    const screen = buildGroupScreen({
      perDevice: [
        buildGroupScreenDeviceState({ deviceId: 'hallway', imagePath: null, renderedAt: null }),
        buildGroupScreenDeviceState({ deviceId: 'kitchen', imagePath: '/screens/devices/kitchen/a.png?v=1', renderedAt: '2026-10-03T07:31:00.000Z' }),
        buildGroupScreenDeviceState({ deviceId: 'study', imagePath: '/screens/devices/study/a.png?v=1', renderedAt: '2026-10-03T07:33:00.000Z' }),
      ],
    })

    expect(thumbnailOf(screen)?.deviceId).toBe('kitchen')
    expect(newestRenderOf(screen)).toBe('2026-10-03T07:33:00.000Z')
    expect(newestRenderOf(buildGroupScreen({ perDevice: [] }))).toBeNull()
  })
})

describe('what the confirmations say', () => {
  it('says what deleting the Group loses and what its Devices go back to', () => {
    expect(deleteGroupWording(buildDeviceGroup({ name: 'Downstairs', members: [kitchen, hallway] }), 3)).toEqual({
      title: 'Delete Downstairs?',
      lost: 'Downstairs and its 3 Screens with their Schedules.',
      stays: 'Kitchen, Hallway: each shows its own Screens again, from the first in its Order.',
    })
    expect(deleteGroupWording(buildDeviceGroup({ name: 'Downstairs', members: [kitchen] }), 1).stays).toBe('Kitchen: it shows its own Screens again, from the first in its Order.')
    expect(deleteGroupWording(buildDeviceGroup({ name: 'Downstairs', members: [] }), 0).stays).toBe('Every Device; none is in this Group.')
  })

  it('says what taking a Device out does', () => {
    expect(leaveGroupWording(kitchen, { name: 'Downstairs' })).toEqual({
      title: 'Take Kitchen out of Downstairs?',
      sentence: 'Kitchen shows its own Screens again, from the first in its Order. Nothing is deleted.',
    })
  })
})
