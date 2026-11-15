import type { ScreenOwner } from 'kuroshiro-shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { EntityManager, Repository } from 'typeorm'
import { DeviceGroup } from '../../device-groups/device-group.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { ApiException } from '../../errors/api.exception.js'
import { isUniqueViolation } from '../../errors/unique-violation.js'
import { closeGapInOrder, joinEndOfOrder } from '../../screens/screen-order.js'
import { ownerRelation } from '../../screens/screen-owner.js'
import { Screen } from '../../screens/screens.entity.js'
import { DevicePlugin } from '../entities/device-plugin.entity.js'
import { Plugin } from '../entities/plugin.entity.js'

@Injectable()
export class PluginAssignmentsService {
  constructor(
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(DevicePlugin)
    private readonly devicePluginRepository: Repository<DevicePlugin>,
  ) {}

  /** The same service reading and writing inside the transaction `manager` runs. */
  within(manager: EntityManager): PluginAssignmentsService {
    return new PluginAssignmentsService(manager.getRepository(Plugin), manager.getRepository(Device), manager.getRepository(DevicePlugin))
  }

  /** Puts the Plugin on the owner as a Plugin Screen at the end of its Order and answers that Screen's id. */
  async assign(pluginId: string, ownerOrDeviceId: ScreenOwner | string): Promise<string> {
    const owner = typeof ownerOrDeviceId === 'string' ? { kind: 'device' as const, id: ownerOrDeviceId } : ownerOrDeviceId
    if (!isUUID(pluginId) || !await this.pluginRepository.existsBy({ id: pluginId }))
      throw new ApiException(HttpStatus.NOT_FOUND, 'plugin-not-found', 'Plugin not found', { id: pluginId })
    await this.assertOwnerExists(owner)
    if (await this.findAssignment(pluginId, owner))
      throw this.alreadyAssigned(pluginId, owner)

    try {
      return await this.devicePluginRepository.manager.transaction(async (manager) => {
        const { device, deviceGroup } = ownerRelation(owner)
        const assignment = await manager.getRepository(DevicePlugin).save({ plugin: { id: pluginId }, device, deviceGroup })
        const screen = await joinEndOfOrder(manager, owner, { type: 'plugin', plugin: { id: pluginId }, devicePluginId: assignment.id })
        return screen.id
      })
    }
    catch (err) {
      if (!isUniqueViolation(err, 'UQ_device_plugin_plugin_device') && !isUniqueViolation(err, 'UQ_device_plugin_plugin_device_group'))
        throw err
      throw this.alreadyAssigned(pluginId, owner)
    }
  }

  async unassign(pluginId: string, owner: ScreenOwner): Promise<void> {
    const assignment = isUUID(pluginId) && isUUID(owner.id) ? await this.findAssignment(pluginId, owner) : null
    if (!assignment)
      throw new ApiException(HttpStatus.NOT_FOUND, 'assignment-not-found', `The Plugin is not assigned to this ${owner.kind === 'device' ? 'Device' : 'Device Group'}.`, { pluginId, ownerId: owner.id })

    await this.devicePluginRepository.manager.transaction(async (manager) => {
      await manager.getRepository(Screen).delete({ devicePluginId: assignment.id })
      await manager.getRepository(DevicePlugin).delete(assignment.id)
      await closeGapInOrder(manager, owner)
    })
  }

  private async assertOwnerExists(owner: ScreenOwner): Promise<void> {
    if (owner.kind === 'device') {
      if (!isUUID(owner.id) || !await this.deviceRepository.existsBy({ id: owner.id }))
        throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id: owner.id })
      return
    }
    if (!isUUID(owner.id) || !await this.deviceRepository.manager.getRepository(DeviceGroup).existsBy({ id: owner.id }))
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-group-not-found', 'Device Group not found', { id: owner.id })
  }

  private alreadyAssigned(pluginId: string, owner: ScreenOwner): ApiException {
    return new ApiException(HttpStatus.CONFLICT, 'plugin-already-assigned', `The Plugin is already assigned to this ${owner.kind === 'device' ? 'Device' : 'Device Group'}.`, { pluginId, ownerId: owner.id })
  }

  private findAssignment(pluginId: string, owner: ScreenOwner): Promise<DevicePlugin | null> {
    return this.devicePluginRepository.findOne({ where: { plugin: { id: pluginId }, ...(owner.kind === 'device' ? { device: { id: owner.id } } : { deviceGroup: { id: owner.id } }) } })
  }
}
