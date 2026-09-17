import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Currency } from '../contracts/currency.enum';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(1)
  priceInMinorUnits!: number;

  @IsEnum(Currency)
  currency!: Currency;

  @IsInt()
  @Min(0)
  initialQuantity!: number;
}
