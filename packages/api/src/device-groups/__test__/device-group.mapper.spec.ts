import { describe, expect, it } from 'vitest'
import { makeDevice } from '../../test/fixtures.js'
import { V2 } from '../../test/mockDeviceModelsService.js'
import { toDeviceGroup, toDeviceGroupSummary } from '../device-group.mapper.js'

const group = { id: 'group-1', name: 'Downstairs' }

describe('toDeviceGroup', () => {
  it('reads the Group with each member\'s Device Model and Palette by name, null where it has none', () => {
    const read = toDeviceGroup(group, [
      makeDevice({ id: 'device-1', name: 'Kitchen', friendlyId: 'KITCHN', deviceModel: V2, palette: { id: 'bw', name: 'Black and white' } as never }),
      makeDevice({ id: 'device-2', name: 'Hall', friendlyId: 'HALLWY', deviceModel: null, palette: null }),
    ])

    expect(read).toEqual({
      id: 'group-1',
      name: 'Downstairs',
      members: [
        { id: 'device-1', name: 'Kitchen', friendlyId: 'KITCHN', deviceModelName: V2.name, paletteName: 'Black and white' },
        { id: 'device-2', name: 'Hall', friendlyId: 'HALLWY', deviceModelName: null, paletteName: null },
      ],
    })
  })
})

describe('toDeviceGroupSummary', () => {
  it('reads the Group with its member and Screen counts', () => {
    expect(toDeviceGroupSummary(group, { memberCount: 2, screenCount: 5 })).toEqual({ id: 'group-1', name: 'Downstairs', memberCount: 2, screenCount: 5 })
  })
})
