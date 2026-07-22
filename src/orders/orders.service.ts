import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Order, OrderStatus } from './entities/order.entity';
import { TrackingHistory } from './entities/tracking-history.entity';
import { CreateOrderDto } from '../common/dtos/create-order.dto';
import { CourierFactory } from '../couriers/courier-factory.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly batchResults = new Map<string, any[]>();

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(TrackingHistory)
    private readonly trackingRepository: Repository<TrackingHistory>,
    private readonly courierFactory: CourierFactory,
  ) {}

  async processSingleOrder(payload: CreateOrderDto, requestId = uuidv4()) {
    const existingOrder = await this.orderRepository.findOne({ where: { internal_order_id: payload.internal_order_id } });
    if (existingOrder) {
      this.logger.log('Order already exists; returning existing record.', {
        orderId: payload.internal_order_id,
        courierPartner: payload.courier_partner,
        requestId,
      });
      return this.serializeOrder(existingOrder);
    }

    let savedOrder: Order | undefined;

    try {
      const order = this.orderRepository.create({
        internal_order_id: payload.internal_order_id,
        courier_partner: payload.courier_partner,
        request_payload: payload,
        status: OrderStatus.CREATED,
      });
      savedOrder = await this.orderRepository.save(order);

      const adapter = this.courierFactory.getAdapter(payload.courier_partner);
      const courierResponse = await adapter.createOrder(payload, requestId);

      savedOrder.courier_order_id = courierResponse.courier_order_id;
      savedOrder.awb_number = courierResponse.awb_number;
      savedOrder.status = this.mapCourierStatus(courierResponse.status ?? OrderStatus.CREATED);
      savedOrder.response_payload = courierResponse.raw_response ?? courierResponse;
      await this.orderRepository.save(savedOrder);
      await this.appendTrackingHistory(savedOrder, savedOrder.status, courierResponse.raw_response ?? courierResponse);

      return this.serializeOrder(savedOrder);
    } catch (error) {
      const normalizedError = this.normalizeCourierError(error);
      if (savedOrder) {
        savedOrder.status = OrderStatus.FAILED;
        savedOrder.response_payload = { error: normalizedError.message, requestId };
        await this.orderRepository.save(savedOrder);
        await this.appendTrackingHistory(savedOrder, OrderStatus.FAILED, {
          error: normalizedError.message,
          requestId,
          rawError: error instanceof Error ? error.message : error,
        });
      }

      this.logger.error('Courier create order failed', error instanceof Error ? error.stack : undefined, {
        orderId: payload.internal_order_id,
        courierPartner: payload.courier_partner,
        requestId,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });

      throw normalizedError;
    }
  }

  async trackOrder(orderId: string, requestId = uuidv4()) {
    const order = await this.findOrder(orderId);
    const adapter = this.courierFactory.getAdapter(order.courier_partner);

    try {
      const courierResponse = await adapter.trackShipment(order.awb_number ?? order.courier_order_id ?? order.internal_order_id, requestId);
      const nextStatus = this.mapCourierStatus(courierResponse.status ?? order.status);
      order.status = nextStatus;
      order.response_payload = courierResponse.raw_response ?? courierResponse;
      await this.orderRepository.save(order);
      await this.appendTrackingHistory(order, order.status, courierResponse.raw_response ?? courierResponse);
      return {
        success: true,
        data: {
          order_id: order.internal_order_id,
          courier_partner: order.courier_partner,
          status: order.status,
          tracking_history: await this.getTrackingHistory(order.id),
        },
      };
    } catch (error) {
      const normalizedError = this.normalizeCourierError(error);
      this.logger.error('Courier track shipment failed', error instanceof Error ? error.stack : undefined, {
        orderId: order.internal_order_id,
        courierPartner: order.courier_partner,
        requestId,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      throw normalizedError;
    }
  }

  async cancelOrder(orderId: string, requestId = uuidv4()) {
    const order = await this.findOrder(orderId);
    const adapter = this.courierFactory.getAdapter(order.courier_partner);

    try {
      const courierResponse = await adapter.cancelOrder(order.courier_order_id ?? order.internal_order_id, requestId);
      const nextStatus = this.mapCourierStatus(courierResponse.status ?? order.status);
      order.status = nextStatus;
      order.response_payload = courierResponse.raw_response ?? courierResponse;
      await this.orderRepository.save(order);
      await this.appendTrackingHistory(order, order.status, courierResponse.raw_response ?? courierResponse);
      return {
        success: true,
        data: {
          order_id: order.internal_order_id,
          courier_partner: order.courier_partner,
          status: order.status,
        },
      };
    } catch (error) {
      const normalizedError = this.normalizeCourierError(error);
      this.logger.error('Courier cancel order failed', error instanceof Error ? error.stack : undefined, {
        orderId: order.internal_order_id,
        courierPartner: order.courier_partner,
        requestId,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      throw normalizedError;
    }
  }

  async queueBulkOrders(batchId: string, payloads: CreateOrderDto[], requestId: string) {
    void this.processBulkOrders(batchId, payloads, requestId);
  }

  async getBatchResults(batchId: string) {
    return this.batchResults.get(batchId) ?? [];
  }

  private async processBulkOrders(batchId: string, payloads: CreateOrderDto[], requestId: string) {
    const settledResults = await Promise.allSettled(payloads.map((payload) => this.processSingleOrder(payload, requestId)));
    const results = settledResults.map((result, index) => ({
      internal_order_id: payloads[index].internal_order_id,
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : undefined,
      error: result.status === 'rejected' ? this.extractErrorMessage(result.reason) : undefined,
    }));

    this.batchResults.set(batchId, results);
    this.logger.log(`Completed bulk order batch ${batchId}`, {
      processed: results.length,
      successful: results.filter((item) => item.success).length,
      failed: results.filter((item) => !item.success).length,
    });
  }

  private async findOrder(orderId: string) {
    const order = await this.orderRepository.findOne({ where: { internal_order_id: orderId } });
    if (order) {
      return order;
    }

    const orderById = await this.orderRepository.findOne({ where: { id: orderId } });
    if (orderById) {
      return orderById;
    }

    throw new NotFoundException({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
  }

  private async appendTrackingHistory(order: Order, status: string, rawPayload: any) {
    const history = this.trackingRepository.create({
      order,
      status,
      raw_payload: rawPayload,
    });
    await this.trackingRepository.save(history);
  }

  private async getTrackingHistory(orderId: string) {
    const history = await this.trackingRepository.find({
      where: { order: { id: orderId } } as any,
      order: { created_at: 'ASC' },
    });
    return history.map((item) => ({
      status: item.status,
      created_at: item.created_at,
      raw_payload: item.raw_payload,
    }));
  }

  private mapCourierStatus(status: string | undefined): OrderStatus {
    if (!status) {
      return OrderStatus.CREATED;
    }

    const normalized = status.toUpperCase().replace(/\s+/g, '_');
    switch (normalized) {
      case 'CREATED':
        return OrderStatus.CREATED;
      case 'PICKED_UP':
        return OrderStatus.PICKED_UP;
      case 'IN_TRANSIT':
        return OrderStatus.IN_TRANSIT;
      case 'DELIVERED':
        return OrderStatus.DELIVERED;
      case 'CANCELLED':
        return OrderStatus.CANCELLED;
      default:
        return OrderStatus.FAILED;
    }
  }

  private normalizeCourierError(error: unknown) {
    const message = this.extractErrorMessage(error);

    if (message.includes('COURIER_AUTHENTICATION_FAILED')) {
      return new InternalServerErrorException({
        message: 'Courier authentication failed and a retry was not possible.',
        code: 'COURIER_AUTHENTICATION_FAILED',
      });
    }

    if (message.includes('COURIER_BAD_REQUEST')) {
      return new BadRequestException({
        message: 'Courier rejected the request.',
        code: 'COURIER_BAD_REQUEST',
      });
    }

    return new InternalServerErrorException({
      message: 'Courier service is unavailable.',
      code: 'COURIER_UNAVAILABLE',
    });
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Unknown error';
  }

  private serializeOrder(order: Order) {
    return {
      id: order.id,
      internal_order_id: order.internal_order_id,
      courier_partner: order.courier_partner,
      courier_order_id: order.courier_order_id,
      awb_number: order.awb_number,
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,
    };
  }
}