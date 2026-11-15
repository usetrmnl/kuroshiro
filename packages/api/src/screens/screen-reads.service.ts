import type { GroupScreen, ScreenRead } from 'kuroshiro-shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { In, IsNull, Repository } from 'typeorm'
import { Alert } from '../alerts/entities/alert.entity.js'
import { DeviceGroup } from '../device-groups/device-group.entity.js'
import { Device } from '../devices/devices.entity.js'
import { ApiException } from '../errors/api.exception.js'
import { needsValues } from '../plugins/plugin-field-values.js'
import { PluginFieldValuesService } from '../plugins/services/plugin-field-values.service.js'
import { fileExists } from '../utils/fileExists.js'
import { DeviceScreen } from './device-screen.entity.js'
import { screenImagePath } from './screen-image-paths.js'
import { renderSignalOf, screenStatesOfDevice } from './screen-states.js'
import { toGroupScreen, toScreenRead } from './screen.mapper.js'
import { Screen } from './screens.entity.js'
import { shownRecordsOf } from './shown-records.js'

@Injectable()
export class ScreenReadsService {
  constructor(
    @InjectRepository(Screen)
    private readonly screenRepository: Repository<Screen>,
    @InjectRepository(DeviceScreen)
    private readonly deviceScreenRepository: Repository<DeviceScreen>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    private readonly fieldValues: PluginFieldValuesService,
  ) {}

  private get groupRepository(): Repository<DeviceGroup> {
    return this.deviceRepository.manager.getRepository(DeviceGroup)
  }

  private get screenRelations() {
    return { schedule: true, plugin: { fields: true }, mashupConfiguration: { slots: { plugin: true } } } as const
  }

  /** The Screens a Device shows, in Order: its Device Group's when it is a member, its own otherwise. */
  async forDevice(deviceId: string): Promise<ScreenRead[]> {
    const device = isUUID(deviceId) ? await this.deviceRepository.findOneBy({ id: deviceId }) : null
    if (!device)
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id: deviceId })

    const records = await shownRecordsOf({ screens: this.screenRepository, records: this.deviceScreenRepository }, device, { create: false, screenRelations: this.screenRelations })
    const screens = records.map(record => record.screen)
    const { renderedIds, storedFieldValues, pluginsWithFetchAlert } = await this.facts(screens, [deviceId])

    const states = screenStatesOfDevice(device, records, new Date())

    return records.map((record) => {
      const { screen } = record
      return toScreenRead(screen, {
        deviceId,
        readOnly: !!device.deviceGroup,
        state: states.get(screen.id)!,
        renderSignal: renderSignalOf(record),
        generatedAt: record.generatedAt,
        isRendered: renderedIds.has(`${deviceId}/${screen.id}`),
        requiredFieldEmpty: !!screen.plugin && needsValues(screen.plugin.fields ?? [], storedFieldValues.get(screen.plugin.id) ?? {}),
        fetchAlertFiring: !!screen.plugin && pluginsWithFetchAlert.has(screen.plugin.id),
      })
    })
  }

  /** A Device Group's Screens in Order, each with every member's state. */
  async forGroup(groupId: string): Promise<GroupScreen[]> {
    if (!isUUID(groupId) || !await this.groupRepository.existsBy({ id: groupId }))
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-group-not-found', 'Device Group not found', { id: groupId })

    const screens = await this.screenRepository.find({ where: { deviceGroup: { id: groupId } }, relations: this.screenRelations, order: { order: 'ASC' } })
    const members = await this.deviceRepository.find({ where: { deviceGroup: { id: groupId } }, order: { name: 'ASC' } })
    const { storedFieldValues, pluginsWithFetchAlert } = await this.facts(screens, [])

    const now = new Date()
    const memberRecords = await Promise.all(members.map(async (member) => {
      const records = await shownRecordsOf({ screens: this.screenRepository, records: this.deviceScreenRepository }, member, { create: false, screenRelations: this.screenRelations })
      return { member, records, states: screenStatesOfDevice(member, records, now) }
    }))

    return screens.map(screen => toGroupScreen(
      screen,
      groupId,
      {
        requiredFieldEmpty: !!screen.plugin && needsValues(screen.plugin.fields ?? [], storedFieldValues.get(screen.plugin.id) ?? {}),
        fetchAlertFiring: !!screen.plugin && pluginsWithFetchAlert.has(screen.plugin.id),
      },
      memberRecords.map(({ member, records, states }) => {
        const record = records.find(candidate => candidate.screen.id === screen.id)
        return {
          deviceId: member.id,
          state: states.get(screen.id)!,
          isActive: record?.isActive ?? false,
          renderSignal: record ? renderSignalOf(record) : null,
          generatedAt: record?.id ? record.generatedAt : null,
        }
      }),
    ))
  }

  /** One Screen: with its Device's state among that Device's Screens, or, for a Device Group's Screen, every member's. */
  async forScreen(screenId: string): Promise<ScreenRead | GroupScreen> {
    const owner = isUUID(screenId) ? await this.screenRepository.findOne({ where: { id: screenId }, relations: { device: true, deviceGroup: true } }) : null
    const read = owner && (owner.deviceGroup
      ? (await this.forGroup(owner.deviceGroup.id)).find(screen => screen.id === screenId)
      : (await this.forDevice(owner.device!.id)).find(screen => screen.id === screenId))
    if (!read)
      throw new ApiException(HttpStatus.NOT_FOUND, 'screen-not-found', 'Screen not found', { id: screenId })
    return read
  }

  private async facts(screens: Screen[], deviceIds: string[]) {
    const pluginIds = [...new Set(screens.flatMap(screen => screen.plugin ? [screen.plugin.id] : []))]
    const [renderedIds, storedFieldValues, pluginsWithFetchAlert] = await Promise.all([
      this.renderedScreenIds(deviceIds, screens),
      this.fieldValues.storedByPlugin(pluginIds),
      this.pluginIdsWithFiringFetchAlert(pluginIds),
    ])
    return { renderedIds, storedFieldValues, pluginsWithFetchAlert }
  }

  /** `deviceId/screenId` of each Screen whose rendered image is on disk for the Device. */
  private async renderedScreenIds(deviceIds: string[], screens: Screen[]): Promise<Set<string>> {
    const pairs = deviceIds.flatMap(deviceId => screens.map(screen => ({ deviceId, screenId: screen.id })))
    const rendered = await Promise.all(pairs.map(async ({ deviceId, screenId }) =>
      await fileExists(screenImagePath(deviceId, screenId)) ? [`${deviceId}/${screenId}`] : [],
    ))
    return new Set(rendered.flat())
  }

  private async pluginIdsWithFiringFetchAlert(pluginIds: string[]): Promise<Set<string>> {
    if (pluginIds.length === 0)
      return new Set()
    const firing = await this.alertRepository.find({
      where: { kind: 'data-source-fetch-failing', resolvedAt: IsNull(), dataSource: { plugin: { id: In(pluginIds) } } },
      relations: { dataSource: { plugin: true } },
    })
    return new Set(firing.flatMap(alert => alert.dataSource ? [alert.dataSource.plugin.id] : []))
  }
}
