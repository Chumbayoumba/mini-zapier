import {
  IsOptional,
  IsString,
  IsDateString,
  Min,
  Max,
  IsNumber,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'dateRangeValidator', async: false })
class DateRangeValidator implements ValidatorConstraintInterface {
  validate(_value: any, args: ValidationArguments) {
    const obj = args.object as WorkflowFilterDto;
    if (obj.startDate && obj.endDate) {
      return new Date(obj.startDate) <= new Date(obj.endDate);
    }
    return true;
  }

  defaultMessage() {
    return 'startDate must be earlier than or equal to endDate';
  }
}

export class WorkflowFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'all'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter workflows created after this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter workflows created before this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  @Validate(DateRangeValidator)
  endDate?: string;
}
