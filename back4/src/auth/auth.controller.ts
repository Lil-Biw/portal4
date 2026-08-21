import { Controller, Post, Get, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, ForgotPasswordDto, ResetPasswordDto } from './auth.dto';
import { Public } from '../common/guards/guards';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // El frontend lo llama al navegar entre rutas protegidas para refrescar la
  // sesión (rol, permisos, centros_asignados) sin forzar un nuevo login.
  @Get('me')
  me(@Req() req: Request) {
    const user = (req as any).user as { sub: string };
    return this.authService.me(user.sub);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.solicitarResetPassword(dto.email);
    return { message: 'Si el correo existe, te enviamos un enlace para restablecer tu contraseña' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password_nueva);
    return { message: 'Contraseña actualizada correctamente' };
  }
}
