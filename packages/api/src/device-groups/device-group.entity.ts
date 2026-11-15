import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

/**
 * A named Screen set that Devices join (ADR-0078). It owns Screens, their
 * Order and their Schedules as a Device does; everything visual is a member's.
 */
@Entity()
export class DeviceGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'text', unique: true })
  name: string
}
