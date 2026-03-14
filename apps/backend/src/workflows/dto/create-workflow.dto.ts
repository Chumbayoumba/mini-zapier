import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength, IsObject } from 'class-validator';

export class CreateWorkflowDto {
  @ApiProperty({ example: 'My Workflow' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'A workflow that does something useful' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  definition?: any;
}
