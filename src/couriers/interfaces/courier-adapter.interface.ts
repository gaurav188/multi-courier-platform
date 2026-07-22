export interface ICourierAdapter {
  authenticate(): Promise<string>;
  createOrder(payload: any, requestId?: string): Promise<any>;
  trackShipment(awbNumber: string, requestId?: string): Promise<any>;
  cancelOrder(orderId: string, requestId?: string): Promise<any>;
}