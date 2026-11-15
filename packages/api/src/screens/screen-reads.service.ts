import type { GroupScreen, ScreenRead } from 'kuroshiro-shared'
import { promises as fs } from 'node:fs'
import path from 'node:path'
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
import { DeviceScreen } from './device-screen.entity.js'
import { screenImagePath } from './screen-image-paths.js'
import { renderSignalOf, screenStatesOfDevice } from './screen-states.js'
import { toGroupScreen, toScreenRead } from './screen.mapper.js'
import { Screen } from './screens.entity.js'
import { placeholderRecordOf, shownRecordsOf } from './shown-records.js'

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
    const { renderedIds, storedFieldValues, pluginsWithFetchAlert } = await this.facts(screens, members.map(member => member.id))

    // One query for every member's records of the Group's Screens; a member that has not met a Screen yet reads a placeholder (ADR-0078).
    const stored = screens.length > 0 && members.length > 0
      ? await this.deviceScreenRepository.find({ where: { device: { id: In(members.map(member => member.id)) }, screen: { id: In(screens.map(screen => screen.id)) } }, relations: { device: true, screen: true } })
      : []
    const now = new Date()
    const memberRecords = members.map((member) => {
      const own = new Map(stored.filter(record => record.device.id === member.id).map(record => [record.screen.id, record]))
      const records = screens.map((screen) => {
        const record = own.get(screen.id) ?? placeholderRecordOf(member, screen)
        record.screen = screen
        return record
      })
      return { member, records, states: screenStatesOfDevice(member, records, now) }
    })

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
          isRendered: renderedIds.has(`${member.id}/${screen.id}`),
        }
      }),
    ))
  }

  /** A Device's own Screens in Order, which it shows unless it is in a Device Group: then they are parked, and none has a Screen State. */
  async ownOf(deviceId: string): Promise<ScreenRead[]> {
    const device = isUUID(deviceId) ? await this.deviceRepository.findOneBy({ id: deviceId }) : null
    if (!device)
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id: deviceId })
    if (!device.deviceGroup)
      return this.forDevice(deviceId)

    const records = await this.deviceScreenRepository.find({
      where: { device: { id: deviceId }, screen: { device: { id: deviceId } } },
      relations: { screen: this.screenRelations },
      order: { screen: { order: 'ASC' } },
    })
    const screens = records.map(record => record.screen)
    const { renderedIds, storedFieldValues, pluginsWithFetchAlert } = await this.facts(screens, [deviceId])

    return records.map(record => toScreenRead(record.screen, {
      deviceId,
      readOnly: false,
      state: { state: null, stateCause: null, picked: false },
      renderSignal: renderSignalOf(record),
      generatedAt: record.generatedAt,
      isRendered: renderedIds.has(`${deviceId}/${record.screen.id}`),
      requiredFieldEmpty: !!record.screen.plugin && needsValues(record.screen.plugin.fields ?? [], storedFieldValues.get(record.screen.plugin.id) ?? {}),
      fetchAlertFiring: !!record.screen.plugin && pluginsWithFetchAlert.has(record.screen.plugin.id),
    }))
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

  /** `deviceId/screenId` of each Screen whose rendered image is on disk for the Device: one directory read per Device, whatever the number of Screens. */
  private async renderedScreenIds(deviceIds: string[], screens: Screen[]): Promise<Set<string>> {
    const screenIds = new Set(screens.map(screen => screen.id))
    const perDevice = await Promise.all(deviceIds.map(async (deviceId) => {
      const files = await fs.readdir(path.dirname(screenImagePath(deviceId, ''))).catch(() => [] as string[])
      return files
        .filter(file => file.endsWith('.png') && screenIds.has(file.slice(0, -'.png'.length)))
        .map(file => `${deviceId}/${file.slice(0, -'.png'.length)}`)
    }))
    return new Set(perDevice.flat())
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
