import { IsString, MinLength, IsOptional, IsArray, ValidateNested, MaxLength, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class BloqueNewsletterDto {
  @IsString() @MinLength(2) @MaxLength(200) titulo: string;
  @IsString() @MinLength(2) cuerpo: string;
}

export class CreateNewsletterDto {
  @IsString() @MinLength(2) @MaxLength(200) titulo: string;
  @IsString() @IsOptional() @MaxLength(300) tagline?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => BloqueNewsletterDto) bloques: BloqueNewsletterDto[];
}

export class UpdateNewsletterDto extends PartialType(CreateNewsletterDto) {}

export class RechazarNewsletterDto {
  @IsString() @MinLength(2) @MaxLength(500) motivo: string;
}
