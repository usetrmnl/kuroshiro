import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Device } from '../devices/devices.entity.js'
import { DeviceScreen } from '../screens/device-screen.entity.js'
import { Screen } from '../screens/screens.entity.js'
import { ScreensModule } from '../screens/screens.module.js'
import { DeviceGroupMembershipService } from './device-group-membership.service.js'
import { DeviceGroup } from './device-group.entity.js'
import { DeviceGroupsController } from './device-groups.controller.js'
import { DeviceGroupsService } from './device-groups.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([DeviceGroup, Device, Screen, DeviceScreen]), ScreensModule],
  controllers: [DeviceGroupsController],
  providers: [DeviceGroupsService, DeviceGroupMembershipService],
  exports: [DeviceGroupMembershipService],
})
export class DeviceGroupsModule {}
