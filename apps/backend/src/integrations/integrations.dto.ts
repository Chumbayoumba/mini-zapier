import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIntegrationDto {
  @ApiProperty({ example: 'TELEGRAM' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ example: 'My Bot' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: { botToken: '123456:ABC-DEF...' } })
  @IsObject()
  config!: Record<string, any>;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class VerifyTelegramDto {
  @ApiProperty({ example: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11' })
  @IsString()
  @IsNotEmpty()
  botToken!: string;
}
