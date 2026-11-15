import type { ScreenRead } from 'kuroshiro-shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { In, IsNull, Repository } from 'typeorm'
import { Alert } from '../alerts/entities/alert.entity.js'
import { Device } from '../devices/devices.entity.js'
import { ApiException } from '../errors/api.exception.js'
import { needsValues } from '../plugins/plugin-field-values.js'
import { PluginFieldValuesService } from '../plugins/services/plugin-field-values.service.js'
import { fileExists } from '../utils/fileExists.js'
import { DeviceScreen } from './device-screen.entity.js'
import { screenImagePath } from './screen-image-paths.js'
import { renderSignalOf, screenStatesOfDevice } from './screen-states.js'
import { toScreenRead } from './screen.mapper.js'
import { Screen } from './screens.entity.js'

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

  /** A Device's Screens in Order. */
  async forDevice(deviceId: string): Promise<ScreenRead[]> {
    const device = isUUID(deviceId) ? await this.deviceRepository.findOneBy({ id: deviceId }) : null
    if (!device)
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id: deviceId })

    const records = await this.deviceScreenRepository.find({
      where: { device: { id: deviceId } },
      relations: { screen: { schedule: true, plugin: { fields: true }, mashupConfiguration: { slots: { plugin: true } } } },
      order: { screen: { order: 'ASC' } },
    })
    const screens = records.map(record => record.screen)
    const pluginIds = [...new Set(screens.flatMap(screen => screen.plugin ? [screen.plugin.id] : []))]
    const [renderedIds, storedFieldValues, pluginsWithFetchAlert] = await Promise.all([
      this.renderedScreenIds(deviceId, screens),
      this.fieldValues.storedByPlugin(pluginIds),
      this.pluginIdsWithFiringFetchAlert(pluginIds),
    ])

    const states = screenStatesOfDevice(device, records, new Date())

    return records.map((record) => {
      const { screen } = record
      return toScreenRead(screen, {
        deviceId,
        state: states.get(screen.id)!,
        renderSignal: renderSignalOf(record),
        generatedAt: record.generatedAt,
        isRendered: renderedIds.has(screen.id),
        requiredFieldEmpty: !!screen.plugin && needsValues(screen.plugin.fields ?? [], storedFieldValues.get(screen.plugin.id) ?? {}),
        fetchAlertFiring: !!screen.plugin && pluginsWithFetchAlert.has(screen.plugin.id),
      })
    })
  }

  /** One Screen, with the Screen State it has among its Device's Screens. */
  async forScreen(screenId: string): Promise<ScreenRead> {
    const owner = isUUID(screenId) ? await this.screenRepository.findOne({ where: { id: screenId }, relations: { device: true } }) : null
    const read = owner && (await this.forDevice(owner.device.id)).find(screen => screen.id === screenId)
    if (!read)
      throw new ApiException(HttpStatus.NOT_FOUND, 'screen-not-found', 'Screen not found', { id: screenId })
    return read
  }

  private async renderedScreenIds(deviceId: string, screens: Screen[]): Promise<Set<string>> {
    const rendered = await Promise.all(screens.map(async screen =>
      await fileExists(screenImagePath(deviceId, screen.id)) ? [screen.id] : [],
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
