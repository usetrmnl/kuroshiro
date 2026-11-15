import type { RenderSignal } from 'kuroshiro-shared'
import type { Relation } from 'typeorm'
import type { Device } from '../devices/devices.entity.js'
import type { Screen } from './screens.entity.js'
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm'

/**
 * What a Screen is to one Device (ADR-0078): the Active Screen mark, the
 * cached Plugin output, the Render Signal and `generatedAt`, keyed by
 * (Device, Screen). Runtime state, so the Configuration Archive never
 * carries it. Every Screen has exactly one today, for the Device that owns it.
 */
@Entity()
@Unique(['device', 'screen'])
export class DeviceScreen {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne('Device', { onDelete: 'CASCADE', nullable: false })
  device: Relation<Device>

  @ManyToOne('Screen', { onDelete: 'CASCADE', nullable: false })
  screen: Relation<Screen>

  @Column({ type: 'boolean', default: false })
  isActive: boolean

  /** `/display` names the image after this, and the Device redraws only on a new name. */
  @Column({ type: 'timestamptz' })
  generatedAt: Date

  @Column({ type: 'text', nullable: true })
  cachedPluginOutput?: string | null

  /** The latest Render Signal observed for this Screen on this Device, cleared whenever its cached output is written or invalidated. */
  @Column({ type: 'text', nullable: true })
  renderSignal?: RenderSignal | null
}
