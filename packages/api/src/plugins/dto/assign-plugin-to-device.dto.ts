import type { AssignPluginInput } from 'kuroshiro-shared'
import { Type } from 'class-transformer'
import { IsDefined, ValidateNested } from 'class-validator'
import { ScreenOwnerDto } from '../../screens/dto/screen-owner.dto.js'

export class AssignPluginToDeviceDto implements AssignPluginInput {
  @IsDefined()
  @ValidateNested()
  @Type(() => ScreenOwnerDto)
  owner: ScreenOwnerDto
}
