// src/couriers/courier-factory.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ICourierAdapter } from './interfaces/courier-adapter.interface';
import { UrbaneBoltAdapter } from './adapters/urbanebolt.adapter';
import { MockCourierAdapter } from './adapters/mock-courier.adapter';

@Injectable()
export class CourierFactory {
  // Registry defining which string maps to which class
  private readonly registry = {
    urbanebolt: UrbaneBoltAdapter,
    mock: MockCourierAdapter,
  };

  constructor(private moduleRef: ModuleRef) {}

  getAdapter(courierPartner: string): ICourierAdapter {
    const adapterClass = this.registry[courierPartner.toLowerCase()];
    if (!adapterClass) {
      throw new BadRequestException(`Courier partner '${courierPartner}' is not supported.`);
    }
    // Resolves the adapter instance from the NestJS DI container
    return this.moduleRef.get(adapterClass, { strict: false });
  }
}