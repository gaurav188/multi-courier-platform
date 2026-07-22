import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersModule } from './orders/orders.module';
import { CouriersModule } from './couriers/couriers.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres' as const,
        url: process.env.DATABASE_URL || 'postgresql://inno@localhost:5432/courier_db',
        autoLoadEntities: true,
        synchronize: true,
        retryAttempts: 5,
        retryDelay: 3000,
        logging: false,
      }),
    }),
    OrdersModule,
    CouriersModule,
  ],
})
export class AppModule {}