// src/couriers/courier-factory.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ICourierAdapter } from './interfaces/courier-adapter.interface';
import { UrbaneBoltAdapter } from './adapters/urbanebolt.adapter';
import { MockCourierAdapter } from './adapters/mock-courier.adapter';

@Injectable()
export class CourierFactory {
  private readonly registry = {
    urbanebolt: UrbaneBoltAdapter,
    mock: MockCourierAdapter,
  };

  constructor(private readonly moduleRef: ModuleRef) {}

  getAdapter(courierPartner: string): ICourierAdapter {
    const normalizedPartner = courierPartner?.toLowerCase();
    const adapterClass = this.registry[normalizedPartner];
    if (!adapterClass) {
      throw new BadRequestException({
        message: 'Unknown courier partner.',
        code: 'COURIER_NOT_SUPPORTED',
        supported_couriers: this.getSupportedCouriers(),
      });
    }

    return this.moduleRef.get(adapterClass, { strict: false });
  }

  getSupportedCouriers(): string[] {
    return Object.keys(this.registry);
  }
}