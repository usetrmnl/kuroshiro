import type { DeviceDetail, DeviceSummary } from 'kuroshiro-shared'
import type { DeviceSummaryFacts } from './device.mapper.js'
import { HttpStatus, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { In, Repository } from 'typeorm'
import { DeviceSensorsService } from '../device-sensors/device-sensors.service.js'
import { ApiException } from '../errors/api.exception.js'
import { DeviceScreen } from '../screens/device-screen.entity.js'
import { Screen } from '../screens/screens.entity.js'
import { toDeviceDetail, toDeviceSummary } from './device.mapper.js'
import { Device } from './devices.entity.js'

function byNameIgnoringCase(a: Device, b: Device): number {
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.friendlyId.localeCompare(b.friendlyId)
}

@Injectable()
export class DeviceReadsService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Screen)
    private readonly screenRepository: Repository<Screen>,
    @InjectRepository(DeviceScreen)
    private readonly deviceScreenRepository: Repository<DeviceScreen>,
    private readonly deviceSensors: DeviceSensorsService,
  ) {}

  async list(): Promise<DeviceSummary[]> {
    const devices = await this.deviceRepository.find()
    const servedScreens = await this.servedScreensById(devices)
    const now = new Date()
    return [...devices]
      .sort(byNameIgnoringCase)
      .map(device => toDeviceSummary(device, { now, servedScreen: this.servedScreenOf(device, servedScreens) }))
  }

  async detail(id: string): Promise<DeviceDetail> {
    const device = isUUID(id) ? await this.deviceRepository.findOneBy({ id }) : null
    if (!device)
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id })
    const [servedScreens, sensors, screenCount] = await Promise.all([
      this.servedScreensById([device]),
      this.deviceSensors.findForDevice(id),
      this.screenRepository.count({ where: { device: { id } } }),
    ])
    return toDeviceDetail(device, { now: new Date(), servedScreen: this.servedScreenOf(device, servedScreens), sensors, screenCount })
  }

  /** The record of the Screen each Device last served, by Device id. */
  private async servedScreensById(devices: Device[]): Promise<Map<string, DeviceScreen>> {
    const servedDevices = devices.filter(device => device.lastServedScreenId)
    if (servedDevices.length === 0)
      return new Map()
    const records = await this.deviceScreenRepository.find({
      where: { device: { id: In(servedDevices.map(device => device.id)) }, screen: { id: In(servedDevices.map(device => device.lastServedScreenId!)) } },
      relations: { device: true, screen: { plugin: true } },
    })
    return new Map(records.map(record => [`${record.device.id}:${record.screen.id}`, record]))
  }

  private servedScreenOf(device: Device, servedScreens: Map<string, DeviceScreen>): DeviceSummaryFacts['servedScreen'] {
    const record = device.lastServedScreenId ? servedScreens.get(`${device.id}:${device.lastServedScreenId}`) : undefined
    return record ? { id: record.screen.id, type: record.screen.type, filename: record.screen.filename, plugin: record.screen.plugin, generatedAt: record.generatedAt } : null
  }
}
