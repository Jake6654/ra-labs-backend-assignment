import { IsNotEmpty, IsString } from 'class-validator';
/**
 *  DTO classes make sure to validate input separtately from the persistence model. This keeps the API layer cleaner and prevents invalid request data from going directly into database model.
 */
export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
