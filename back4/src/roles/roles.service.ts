import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RolDocument } from './roles.schema';
import { CreateRolDto, UpdateRolDto } from './roles.dto';

@Injectable()
export class RolesService {
  constructor(@InjectModel('Rol') private rolModel: Model<RolDocument>) {}

  async create(dto: CreateRolDto) {
    const existe = await this.rolModel.findOne({ nombre: dto.nombre });
    if (existe) throw new ConflictException(`Ya existe un rol llamado "${dto.nombre}"`);
    return this.rolModel.create(dto);
  }

  async findAll() {
    return this.rolModel.find().sort({ nombre: 1 }).lean();
  }

  async findOne(id: string) {
    const rol = await this.rolModel.findById(id).lean();
    if (!rol) throw new NotFoundException(`Rol ${id} no encontrado`);
    return rol;
  }

  async update(id: string, dto: UpdateRolDto) {
    const rol = await this.rolModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .lean();
    if (!rol) throw new NotFoundException(`Rol ${id} no encontrado`);
    return rol;
  }

  async remove(id: string) {
    const rol = await this.rolModel.findByIdAndDelete(id).lean();
    if (!rol) throw new NotFoundException(`Rol ${id} no encontrado`);
    return { message: 'Rol eliminado', id };
  }
}
