import type { DeviceGroup as DeviceGroupRead, DeviceGroupSummary } from 'kuroshiro-shared'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { Repository } from 'typeorm'
import { Device } from '../devices/devices.entity.js'
import { ApiException } from '../errors/api.exception.js'
import { isUniqueViolation } from '../errors/unique-violation.js'
import { Screen } from '../screens/screens.entity.js'
import { ScreensService } from '../screens/screens.service.js'
import { DeviceGroupMembershipService } from './device-group-membership.service.js'
import { DeviceGroup } from './device-group.entity.js'
import { toDeviceGroup, toDeviceGroupSummary } from './device-group.mapper.js'
import { CreateDeviceGroupDto, UpdateDeviceGroupDto } from './dto/device-group.dto.js'

@Injectable()
export class DeviceGroupsService {
  private readonly logger = new Logger(DeviceGroupsService.name)

  constructor(
    @InjectRepository(DeviceGroup)
    private readonly groupRepository: Repository<DeviceGroup>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Screen)
    private readonly screenRepository: Repository<Screen>,
    private readonly membership: DeviceGroupMembershipService,
    private readonly screensService: ScreensService,
  ) {}

  async list(): Promise<DeviceGroupSummary[]> {
    const groups = await this.groupRepository.find({ order: { name: 'ASC' } })
    return Promise.all(groups.map(async group => toDeviceGroupSummary(group, {
      memberCount: await this.deviceRepository.countBy({ deviceGroup: { id: group.id } }),
      screenCount: await this.screenRepository.countBy({ deviceGroup: { id: group.id } }),
    })))
  }

  async detail(id: string): Promise<DeviceGroupRead> {
    const group = await this.groupOrRefuse(id)
    const members = await this.deviceRepository.find({ where: { deviceGroup: { id } }, order: { name: 'ASC' } })
    return toDeviceGroup(group, members)
  }

  async create(input: CreateDeviceGroupDto): Promise<string> {
    const id = await this.saveNamed(() => this.groupRepository.save(this.groupRepository.create({ name: input.name })).then(group => group.id), input.name)
    this.logger.log(`Device Group created: ${id}`)
    return id
  }

  async rename(id: string, input: UpdateDeviceGroupDto): Promise<string> {
    const group = await this.groupOrRefuse(id)
    if (input.name !== undefined && input.name !== group.name)
      await this.saveNamed(() => this.groupRepository.update({ id }, { name: input.name }).then(() => id), input.name)
    return id
  }

  /** Has every member leave, then deletes the Group, its Screens and their files. */
  async delete(id: string): Promise<void> {
    await this.groupOrRefuse(id)
    this.logger.log(`Deleting Device Group ${id}`)
    await this.membership.emptyGroup(id)
    await this.screensService.deleteFilesOfGroup(id)
    await this.groupRepository.delete(id)
  }

  async groupOrRefuse(id: string): Promise<DeviceGroup> {
    const group = isUUID(id) ? await this.groupRepository.findOneBy({ id }) : null
    if (!group)
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-group-not-found', 'Device Group not found', { id })
    return group
  }

  private async saveNamed<T>(save: () => Promise<T>, name: string): Promise<T> {
    try {
      return await save()
    }
    catch (err) {
      if (!isUniqueViolation(err))
        throw err
      throw new ApiException(HttpStatus.CONFLICT, 'device-group-name-taken', 'A Device Group with this name already exists.', { name })
    }
  }
}
