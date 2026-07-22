import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CourierFactory } from './courier-factory.service';
import { UrbaneBoltAdapter } from './adapters/urbanebolt.adapter';
import { MockCourierAdapter } from './adapters/mock-courier.adapter';

@Module({
  imports: [HttpModule],
  providers: [CourierFactory, UrbaneBoltAdapter, MockCourierAdapter],
  exports: [CourierFactory],
})
export class CouriersModule {}