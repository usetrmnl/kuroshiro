import type { AssignPluginInput } from 'kuroshiro-shared'
import { Type } from 'class-transformer'
import { IsDefined, IsUUID, ValidateIf, ValidateNested } from 'class-validator'
import { ScreenOwnerDto } from '../../screens/dto/screen-owner.dto.js'

export class AssignPluginToDeviceDto implements AssignPluginInput {
  @ValidateIf((input: AssignPluginToDeviceDto) => input.deviceId === undefined)
  @IsDefined()
  @ValidateNested()
  @Type(() => ScreenOwnerDto)
  owner?: ScreenOwnerDto

  @ValidateIf((input: AssignPluginToDeviceDto) => input.owner === undefined)
  @IsUUID()
  deviceId?: string
}
