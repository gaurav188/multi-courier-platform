import { Injectable } from '@nestjs/common';
import { ICourierAdapter } from '../interfaces/courier-adapter.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MockCourierAdapter implements ICourierAdapter {
  async authenticate(): Promise<string> {
    return 'mock-token-123';
  }

  async createOrder(payload: any, requestId?: string): Promise<any> {
    return {
      courier_order_id: `MOCK-ORD-${uuidv4().substring(0, 8)}`,
      awb_number: `MOCK-AWB-${uuidv4().substring(0, 8)}`,
      status: 'CREATED',
      raw_response: { message: 'Mock order created successfully', original_payload: payload, requestId },
    };
  }

  async trackShipment(awbNumber: string, requestId?: string): Promise<any> {
    return { status: 'IN_TRANSIT', location: 'Mock Hub', requestId };
  }

  async cancelOrder(orderId: string, requestId?: string): Promise<any> {
    return { status: 'CANCELLED', requestId };
  }
}