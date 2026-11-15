import type { CreateDeviceGroupInput, UpdateDeviceGroupInput } from 'kuroshiro-shared'
import { Transform } from 'class-transformer'
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { trimmed } from '../../utils/trimmed.js'

export class CreateDeviceGroupDto implements CreateDeviceGroupInput {
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  name: string
}

export class UpdateDeviceGroupDto implements UpdateDeviceGroupInput {
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  name?: string
}
