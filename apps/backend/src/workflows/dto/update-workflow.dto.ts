import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowDefinitionDto } from './workflow-definition.dto';

export class UpdateWorkflowDto {
  @ApiPropertyOptional({ example: 'Updated Workflow Name' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowDefinitionDto)
  definition?: WorkflowDefinitionDto;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  changelog?: string;
}
