import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { ICourierAdapter } from '../interfaces/courier-adapter.interface';

@Injectable()
export class UrbaneBoltAdapter implements ICourierAdapter {
  private readonly baseUrl = process.env.URBANEBOLT_BASE_URL ?? 'https://urbanebolt-uat.example.com';
  private readonly apiKey = process.env.URBANEBOLT_API_KEY ?? 'demo-key';
  private readonly timeoutMs = Number(process.env.URBANEBOLT_TIMEOUT_MS ?? 10000);
  private readonly retries = Number(process.env.URBANEBOLT_RETRY_ATTEMPTS ?? 2);
  private readonly backoffMs = Number(process.env.URBANEBOLT_RETRY_DELAY_MS ?? 500);

  constructor(private readonly httpService: HttpService) {}

  async authenticate(): Promise<string> {
    return this.apiKey;
  }

  async createOrder(payload: any, requestId?: string): Promise<any> {
    const ubPayload = {
      orderId: payload.internal_order_id,
      courierPartner: payload.courier_partner,
      customer: payload.customer_details,
      package: payload.package_details,
      requestId,
    };

    return this.withRetry(async () => {
      const token = await this.authenticate();
      const response = await lastValueFrom(
        this.httpService.post(`${this.baseUrl}/shipments`, ubPayload, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: this.timeoutMs,
        }),
      );

      return {
        courier_order_id: response.data.orderRef ?? `URB-${payload.internal_order_id}`,
        awb_number: response.data.trackingCode ?? `UB-${Date.now()}`,
        status: response.data.status ?? 'CREATED',
        raw_response: response.data,
      };
    });
  }

  async trackShipment(awbNumber: string, requestId?: string): Promise<any> {
    return this.withRetry(async () => {
      const token = await this.authenticate();
      const response = await lastValueFrom(
        this.httpService.get(`${this.baseUrl}/shipments/${awbNumber}`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: this.timeoutMs,
        }),
      );

      return {
        status: response.data.status ?? 'IN_TRANSIT',
        raw_response: { ...response.data, requestId },
      };
    });
  }

  async cancelOrder(orderId: string, requestId?: string): Promise<any> {
    return this.withRetry(async () => {
      const token = await this.authenticate();
      const response = await lastValueFrom(
        this.httpService.post(`${this.baseUrl}/shipments/${orderId}/cancel`, {}, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: this.timeoutMs,
        }),
      );

      return {
        status: response.data.status ?? 'CANCELLED',
        raw_response: { ...response.data, requestId },
      };
    });
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt === this.retries) {
          break;
        }

        const status = this.extractStatus(error);
        const shouldRetry = status === 408 || status === 429 || status >= 500 || this.isAuthenticationError(error);
        if (!shouldRetry) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, this.backoffMs * (attempt + 1)));
      }
    }

    throw this.toCourierError(lastError);
  }

  private extractStatus(error: unknown): number {
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const response = (error as { response?: { status?: number } }).response;
      if (response?.status) {
        return response.status;
      }
    }
    return 0;
  }

  private isAuthenticationError(error: unknown): boolean {
    return this.extractStatus(error) === 401 || (error instanceof Error && error.message.includes('auth'));
  }

  private toCourierError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error('COURIER_UNAVAILABLE');
  }
}