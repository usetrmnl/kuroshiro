import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AdminAuth } from './admin-auth.js'
import { AuthController } from './auth.controller.js'

@Global()
@Module({
  controllers: [AuthController],
  providers: [{ provide: AdminAuth, inject: [ConfigService], useFactory: (config: ConfigService) => new AdminAuth(config.get<string>('admin_password')) }],
  exports: [AdminAuth],
})
export class AuthModule {}
