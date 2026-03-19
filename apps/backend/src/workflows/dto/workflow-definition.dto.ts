import { Type } from 'class-transformer';
import {
  IsString,
  IsArray,
  IsNumber,
  IsOptional,
  IsObject,
  ValidateNested,
} from 'class-validator';

export class NodePositionDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

export class NodeDataDto {
  @IsString()
  label!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @IsString()
  description?: string;
}

export class WorkflowNodeDto {
  @IsString()
  id!: string;

  @IsString()
  type!: string;

  @ValidateNested()
  @Type(() => NodePositionDto)
  position!: NodePositionDto;

  @ValidateNested()
  @Type(() => NodeDataDto)
  data!: NodeDataDto;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  measured?: any;

  @IsOptional()
  selected?: boolean;

  @IsOptional()
  dragging?: boolean;
}

export class WorkflowEdgeDto {
  @IsString()
  id!: string;

  @IsString()
  source!: string;

  @IsString()
  target!: string;

  @IsOptional()
  @IsString()
  sourceHandle?: string;

  @IsOptional()
  @IsString()
  targetHandle?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  animated?: boolean;
}

export class WorkflowDefinitionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowNodeDto)
  nodes!: WorkflowNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowEdgeDto)
  edges!: WorkflowEdgeDto[];

  @IsOptional()
  viewport?: any;
}
