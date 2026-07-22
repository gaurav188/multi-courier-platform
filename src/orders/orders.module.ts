import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { BulkOrdersProcessor } from './bulk-orders.processor';
import { Order } from './entities/order.entity';
import { TrackingHistory } from './entities/tracking-history.entity';
import { CouriersModule } from '../couriers/couriers.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, TrackingHistory]), CouriersModule],
  controllers: [OrdersController],
  providers: [OrdersService, BulkOrdersProcessor],
})
export class OrdersModule {}