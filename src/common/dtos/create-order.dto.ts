import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  internal_order_id: string;

  @IsString()
  @IsNotEmpty()
  courier_partner: string;

  @IsObject()
  @IsOptional()
  customer_details?: any;

  @IsObject()
  @IsOptional()
  package_details?: any;
}