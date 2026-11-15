import type { DeviceGroup, DeviceGroupSummary, GroupScreen } from 'kuroshiro-shared'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put } from '@nestjs/common'
import { ReorderScreensDto } from '../screens/dto/reorder-screens.dto.js'
import { ScreenReadsService } from '../screens/screen-reads.service.js'
import { ScreensService } from '../screens/screens.service.js'
import { DeviceGroupsService } from './device-groups.service.js'
import { CreateDeviceGroupDto, UpdateDeviceGroupDto } from './dto/device-group.dto.js'

@Controller('device-groups')
export class DeviceGroupsController {
  constructor(
    private readonly groups: DeviceGroupsService,
    private readonly screenReads: ScreenReadsService,
    private readonly screensService: ScreensService,
  ) {}

  @Get()
  async list(): Promise<DeviceGroupSummary[]> {
    return this.groups.list()
  }

  @Post()
  async create(@Body() body: CreateDeviceGroupDto): Promise<DeviceGroup> {
    return this.groups.detail(await this.groups.create(body))
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<DeviceGroup> {
    return this.groups.detail(id)
  }

  @Patch(':id')
  async rename(@Param('id') id: string, @Body() body: UpdateDeviceGroupDto): Promise<DeviceGroup> {
    return this.groups.detail(await this.groups.rename(id, body))
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.groups.delete(id)
  }

  @Get(':id/screens')
  async screens(@Param('id') id: string): Promise<GroupScreen[]> {
    return this.screenReads.forGroup(id)
  }

  @Put(':id/screens/order')
  async reorder(@Param('id') id: string, @Body() body: ReorderScreensDto): Promise<GroupScreen[]> {
    await this.screensService.reorder({ kind: 'deviceGroup', id }, body.screenIds)
    return this.screenReads.forGroup(id)
  }
}
