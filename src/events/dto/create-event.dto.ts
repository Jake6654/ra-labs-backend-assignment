import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { EventStatus } from '../../common/enums/event-status.enum';

/**
 * This DTO class defines the expected request body for creating an event
 */
export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(EventStatus) // status value must match one of the allowed enum values
  status: EventStatus;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  inviteeIds: number[];
}
