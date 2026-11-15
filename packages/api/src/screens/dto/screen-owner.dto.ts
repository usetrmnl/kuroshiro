import type { ScreenOwner } from 'kuroshiro-shared'
import { IsIn, IsUUID } from 'class-validator'

export class ScreenOwnerDto implements ScreenOwner {
  @IsIn(['device', 'deviceGroup'])
  kind: ScreenOwner['kind']

  @IsUUID()
  id: string
}
