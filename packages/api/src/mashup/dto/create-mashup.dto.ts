import type { CreateMashupInput, MashupLayout } from 'kuroshiro-shared'
import { Transform, Type } from 'class-transformer'
import { ArrayUnique, IsArray, IsDefined, IsIn, IsNotEmpty, IsString, IsUUID, ValidateIf, ValidateNested } from 'class-validator'
import { ScreenOwnerDto } from '../../screens/dto/screen-owner.dto.js'
import { trimmed } from '../../utils/trimmed.js'
import { MASHUP_LAYOUT_IDS } from '../constants/layouts.js'

export class CreateMashupDto implements CreateMashupInput {
  @ValidateIf((input: CreateMashupDto) => input.deviceId === undefined)
  @IsDefined()
  @ValidateNested()
  @Type(() => ScreenOwnerDto)
  owner?: ScreenOwnerDto

  /** Deprecated: read as `{ owner: { kind: 'device', id } }`. */
  @ValidateIf((input: CreateMashupDto) => input.owner === undefined)
  @IsUUID()
  deviceId?: string

  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  name: string

  @IsIn(MASHUP_LAYOUT_IDS)
  layout: MashupLayout

  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayUnique()
  pluginIds: string[]
}
