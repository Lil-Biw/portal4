import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { MailService } from '../mail/mail.service';

const RESET_PASSWORD_PURPOSE = 'reset_password';

// Huella corta del hash actual de la contraseña: viaja en el token de reseteo
// y se revalida al usarlo. Como cambia en cuanto la contraseña se actualiza,
// un link ya usado (o uno viejo tras otro reseteo) deja de ser válido sin
// necesidad de una colección aparte para llevar el registro de tokens usados.
function huellaPassword(passwordHash: string): string {
  return crypto.createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel('Usuario') private usuarioModel: Model<any>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  async login(email: string, password: string) {
    const usuario: any = await this.usuarioModel
      .findOne({ email, activo: true })
      .select('+password_hash')
      .lean();

    if (!usuario) throw new UnauthorizedException('Credenciales inválidas');

    const valida = await bcrypt.compare(password, usuario.password_hash);
    if (!valida) throw new UnauthorizedException('Credenciales inválidas');

    await this.usuarioModel.updateOne({ _id: usuario._id }, { ultimo_acceso: new Date() });

    const payload = {
      sub: usuario._id.toString(),
      email: usuario.email,
      rol: usuario.rol,
      cliente_id: usuario.cliente_id ? usuario.cliente_id.toString() : null,
    };

    return {
      access_token: this.jwtService.sign(payload),
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        cliente_id: usuario.cliente_id ? usuario.cliente_id.toString() : null,
        debe_cambiar_password: usuario.debe_cambiar_password ?? false,
        permisos: usuario.permisos ?? {},
      },
    };
  }

  // Siempre resuelve sin distinguir si el email existe o no (evita enumeración
  // de cuentas desde el formulario de "olvidé mi contraseña").
  async solicitarResetPassword(email: string): Promise<void> {
    const usuario: any = await this.usuarioModel
      .findOne({ email, activo: true })
      .select('+password_hash')
      .lean();
    if (!usuario) return;

    const token = this.jwtService.sign(
      { sub: usuario._id.toString(), purpose: RESET_PASSWORD_PURPOSE, pwv: huellaPassword(usuario.password_hash) },
      { expiresIn: '30m' },
    );
    const portalUrl = this.configService.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
    const resetUrl = `${portalUrl}/restablecer-password?token=${token}`;

    await this.mailService.notificarRecuperarPassword({ nombre: usuario.nombre, email: usuario.email, resetUrl });
  }

  async resetPassword(token: string, passwordNueva: string): Promise<void> {
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('El enlace de recuperación es inválido o expiró');
    }
    if (payload.purpose !== RESET_PASSWORD_PURPOSE) {
      throw new UnauthorizedException('El enlace de recuperación es inválido o expiró');
    }

    const usuario: any = await this.usuarioModel.findById(payload.sub).select('+password_hash');
    if (!usuario || huellaPassword(usuario.password_hash) !== payload.pwv) {
      // La huella no coincide: el link ya se usó o la contraseña cambió después.
      throw new UnauthorizedException('El enlace de recuperación es inválido o expiró');
    }

    usuario.password_hash = await bcrypt.hash(passwordNueva, 10);
    usuario.debe_cambiar_password = false;
    await usuario.save();
  }
}
