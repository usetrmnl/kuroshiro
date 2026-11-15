import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { Repository } from 'typeorm'
import { Device } from '../devices/devices.entity.js'
import { ApiException } from '../errors/api.exception.js'
import { DeviceScreen } from '../screens/device-screen.entity.js'
import { screenImagePath } from '../screens/screen-image-paths.js'
import { deleteFileIfExists } from '../utils/stagedImageUpload.js'
import { DeviceGroup } from './device-group.entity.js'

/**
 * Joining, moving between and leaving Device Groups (ADR-0078). Every change
 * resets the Device's Rotation: its Picked Screen goes, no Screen is Active,
 * and the records of the previous Group's Screens are dropped with their
 * images, so the next poll starts the new owner's Order from the first Screen.
 * The Device's own Screens stay stored, with their records, inactive.
 */
@Injectable()
export class DeviceGroupMembershipService {
  private readonly logger = new Logger(DeviceGroupMembershipService.name)

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(DeviceGroup)
    private readonly groupRepository: Repository<DeviceGroup>,
    @InjectRepository(DeviceScreen)
    private readonly recordRepository: Repository<DeviceScreen>,
  ) {}

  /** Puts the Device in the Group, or (`null`) takes it out of its Group. Refuses a Group that does not exist; a change to the Group it is already in does nothing. */
  async setGroup(device: Device, groupId: string | null): Promise<void> {
    const group = groupId === null ? null : await this.groupOrRefuse(groupId)
    if ((device.deviceGroup?.id ?? null) === groupId)
      return
    this.logger.log(`Device ${device.id} moves from Device Group ${device.deviceGroup?.id ?? 'none'} to ${groupId ?? 'none'}`)
    await this.dropGroupRecords(device)
    await this.recordRepository.update({ device: { id: device.id } }, { isActive: false })
    await this.deviceRepository.update({ id: device.id }, { deviceGroup: group, pickedScreen: null })
    device.deviceGroup = group
    device.pickedScreen = null
  }

  /** Has every member leave. */
  async emptyGroup(groupId: string): Promise<void> {
    const members = await this.deviceRepository.find({ where: { deviceGroup: { id: groupId } } })
    for (const member of members)
      await this.setGroup(member, null)
  }

  private async groupOrRefuse(groupId: string): Promise<DeviceGroup> {
    const group = isUUID(groupId) ? await this.groupRepository.findOneBy({ id: groupId }) : null
    if (!group)
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-group-not-found', 'Device Group not found', { id: groupId })
    return group
  }

  /** Deletes the Device's records, and its converted images, of the Screens of the Group it is leaving. */
  private async dropGroupRecords(device: Device): Promise<void> {
    if (!device.deviceGroup)
      return
    const records = await this.recordRepository.find({ where: { device: { id: device.id }, screen: { deviceGroup: { id: device.deviceGroup.id } } }, relations: { screen: true } })
    for (const record of records)
      await deleteFileIfExists(screenImagePath(device.id, record.screen.id), this.logger)
    if (records.length > 0)
      await this.recordRepository.delete(records.map(record => record.id))
  }
}
