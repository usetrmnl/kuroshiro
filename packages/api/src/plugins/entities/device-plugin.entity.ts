import { Check, Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { DeviceGroup } from '../../device-groups/device-group.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { Plugin } from './plugin.entity.js'

/** A Plugin put on a Device or on a Device Group (ADR-0078), exactly one of them. */
@Entity()
@Unique('UQ_device_plugin_plugin_device', ['plugin', 'device'])
@Unique('UQ_device_plugin_plugin_device_group', ['plugin', 'deviceGroup'])
@Check('CHK_device_plugin_exactly_one_owner', '("deviceId" IS NULL) <> ("deviceGroupId" IS NULL)')
export class DevicePlugin {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('boolean', { default: true })
  isActive: boolean

  @Column('int', { default: 0 })
  order: number

  @ManyToOne(() => Device, { onDelete: 'CASCADE', nullable: true })
  device?: Device | null

  @ManyToOne(() => DeviceGroup, { onDelete: 'CASCADE', nullable: true })
  deviceGroup?: DeviceGroup | null

  @ManyToOne(() => Plugin, plugin => plugin.deviceAssignments, { onDelete: 'CASCADE' })
  plugin: Plugin
}
