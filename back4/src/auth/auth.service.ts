import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel('Usuario') private usuarioModel: Model<any>,
    private jwtService: JwtService,
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
      },
    };
  }
}
