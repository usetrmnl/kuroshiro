import { Controller, Get } from '@nestjs/common'
import { FrameworkVersionsService } from './services/framework-versions.service.js'

/** The TRMNL Framework versions the Plugin's Framework Version field suggests (ADR-0041). Empty when GitHub could not be asked. */
@Controller('framework-versions')
export class FrameworkVersionsController {
  constructor(private readonly frameworkVersions: FrameworkVersionsService) {}

  @Get()
  async versions(): Promise<string[]> {
    return this.frameworkVersions.versions()
  }
}
