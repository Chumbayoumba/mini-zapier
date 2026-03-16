import { IsString, IsNotEmpty, IsOptional, IsObject, IsNumber, IsBoolean } from 'class-validator';
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

export class VerifySMTPDto {
  @ApiProperty({ example: 'smtp.gmail.com' })
  @IsString()
  @IsNotEmpty()
  host!: string;

  @ApiProperty({ example: 587 })
  @IsNumber()
  port!: number;

  @ApiProperty({ example: 'user@gmail.com' })
  @IsString()
  @IsNotEmpty()
  user!: string;

  @ApiProperty({ example: 'app-password' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  secure?: boolean;
}

export class VerifyWebhookDto2 {
  @ApiProperty({ example: 'My Webhook' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'https://example.com/webhook' })
  @IsString()
  @IsOptional()
  url?: string;
}

export class VerifyHTTPApiDto {
  @ApiProperty({ example: 'https://api.example.com' })
  @IsString()
  @IsNotEmpty()
  baseUrl!: string;

  @ApiPropertyOptional({ example: { 'X-API-Key': 'abc123' } })
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;
}

export class VerifyDatabaseDto {
  @ApiProperty({ example: 'postgresql://user:pass@localhost:5432/db' })
  @IsString()
  @IsNotEmpty()
  connectionString!: string;
}
