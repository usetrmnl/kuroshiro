import type { Request, Response } from 'express'
import type { SignInInput } from 'kuroshiro-shared'
import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common'
import { ApiException } from '../errors/api.exception.js'
import { AdminAuth, SESSION_COOKIE } from './admin-auth.js'
import { tooManyAttempts } from './admin-password.guard.js'
import { OpenToSignIn } from './open-to-sign-in.decorator.js'

function arrivedOverHttps(request: Request): boolean {
  return request.secure || request.headers['x-forwarded-proto']?.toString().split(',')[0]?.trim() === 'https'
}

@Controller('auth')
@OpenToSignIn()
export class AuthController {
  constructor(private readonly auth: AdminAuth) {}

  @Post('login')
  @HttpCode(HttpStatus.NO_CONTENT)
  login(@Body() body: Partial<SignInInput> | undefined, @Req() request: Request, @Res({ passthrough: true }) response: Response): void {
    const address = request.ip ?? ''
    if (this.auth.isThrottled(address))
      throw tooManyAttempts()
    const password = body?.password
    if (!this.auth.enabled || typeof password !== 'string' || !this.auth.isPassword(password)) {
      if (this.auth.enabled)
        this.auth.recordWrong(address)
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'wrong-password', 'That is not the admin password.')
    }
    const { value, maxAgeMs } = this.auth.issueSession()
    response.cookie(SESSION_COOKIE, value, { httpOnly: true, sameSite: 'strict', secure: arrivedOverHttps(request), maxAge: maxAgeMs, path: '/' })
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): void {
    response.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', secure: arrivedOverHttps(request), path: '/' })
  }
}
