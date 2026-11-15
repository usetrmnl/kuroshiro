import type { GroupScreen, ScreenRead } from 'kuroshiro-shared'
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { AssignPluginToDeviceDto } from '../plugins/dto/assign-plugin-to-device.dto.js'
import { PluginAssignmentsService } from '../plugins/services/plugin-assignments.service.js'
import { ScreenReadsService } from './screen-reads.service.js'

/**
 * A Plugin Assignment is answered as the Screen it puts on the Device (or on
 * the Device Group, read as the Screen of its first member), which is why
 * these `plugins` routes are served from the Screens module.
 */
@Controller('plugins/:pluginId')
export class PluginAssignmentsController {
  constructor(private readonly assignments: PluginAssignmentsService, private readonly screenReads: ScreenReadsService) {}

  @Post('assign')
  async assign(@Param('pluginId') pluginId: string, @Body() body: AssignPluginToDeviceDto): Promise<ScreenRead | GroupScreen> {
    return this.screenReads.forScreen(await this.assignments.assign(pluginId, body.owner))
  }

  @Delete('assignments/device-groups/:groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unassignFromGroup(@Param('pluginId') pluginId: string, @Param('groupId') groupId: string): Promise<void> {
    await this.assignments.unassign(pluginId, { kind: 'deviceGroup', id: groupId })
  }

  @Delete('assignments/:deviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unassign(@Param('pluginId') pluginId: string, @Param('deviceId') deviceId: string): Promise<void> {
    await this.assignments.unassign(pluginId, { kind: 'device', id: deviceId })
  }
}
