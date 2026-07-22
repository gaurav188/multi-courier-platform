import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersModule } from './orders/orders.module';
import { CouriersModule } from './couriers/couriers.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgresql://root:root@localhost:5432/courier_db',
      autoLoadEntities: true,
      synchronize: true,
    }),
    OrdersModule,
    CouriersModule,
  ],
})
export class AppModule {}