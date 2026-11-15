import { describe, expect, it } from 'vitest'
import { makeDevice } from '../../test/fixtures.js'
import { V2 } from '../../test/mockDeviceModelsService.js'
import { toDeviceGroup, toDeviceGroupSummary } from '../device-group.mapper.js'

const group = { id: 'group-1', name: 'Downstairs' }

describe('toDeviceGroup', () => {
  it('reads the Group with each member\'s Device Model and Palette, null where it has none, and whether it is mirrored or Proxied', () => {
    const read = toDeviceGroup(group, [
      makeDevice({ id: 'device-1', name: 'Kitchen', friendlyId: 'KITCHN', deviceModel: V2, palette: { id: 'bw', name: 'Black and white', kind: 'official' } as never }),
      makeDevice({ id: 'device-2', name: 'Hall', friendlyId: 'HALLWY', deviceModel: null, palette: null, mac: 'AA:BB:CC:DD:EE:02', mirrorEnabled: true, mirrorMac: 'AA:BB:CC:DD:EE:02' }),
    ])

    expect(read).toEqual({
      id: 'group-1',
      name: 'Downstairs',
      members: [
        { id: 'device-1', name: 'Kitchen', friendlyId: 'KITCHN', deviceModel: { name: V2.name, label: V2.label, width: V2.width, height: V2.height, deprecated: V2.deprecated }, palette: { id: 'bw', name: 'Black and white', kind: 'official' }, isMirrored: false, isProxied: false },
        { id: 'device-2', name: 'Hall', friendlyId: 'HALLWY', deviceModel: null, palette: null, isMirrored: true, isProxied: true },
      ],
    })
  })
})

describe('toDeviceGroupSummary', () => {
  it('reads the Group with its member and Screen counts', () => {
    expect(toDeviceGroupSummary(group, { memberCount: 2, screenCount: 5 })).toEqual({ id: 'group-1', name: 'Downstairs', memberCount: 2, screenCount: 5 })
  })
})
