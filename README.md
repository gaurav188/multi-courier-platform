# Multi-Courier Integration Platform

This repository contains a NestJS-based backend service that exposes a unified courier-agnostic API for order creation, tracking, cancellation, and bulk processing. UrbaneBolt is implemented as the first concrete adapter, and a mock adapter is included to demonstrate pluggable courier support.

## Features

- Unified REST API for consumers: create, track, cancel, and bulk create orders.
- Courier abstraction via a factory and adapter interface so new providers can be added without changing the controller or DTOs.
- Persistence for orders and tracking history in PostgreSQL.
- Background-friendly bulk processing and per-order success/failure reporting.
- Normalized error responses and request-id-based logging.

## Requirements

- Node.js 20+
- PostgreSQL
- Optional: Redis if you later expand the queue implementation

## Setup

1. Install dependencies
   ```bash
   npm install
   ```
2. Copy the environment sample
   ```bash
   cp .env.example .env
   ```
3. Update the database and courier settings in .env.
4. Start PostgreSQL and ensure the database exists.
5. Run the app
   ```bash
   npm run start:dev
   ```

## Environment Variables

- DATABASE_URL: PostgreSQL connection string.
- URBANEBOLT_BASE_URL: UrbaneBolt base URL.
- URBANEBOLT_API_KEY: Courier API key.
- URBANEBOLT_TIMEOUT_MS: HTTP timeout in milliseconds.
- URBANEBOLT_RETRY_ATTEMPTS: Number of retry attempts for transient failures.
- URBANEBOLT_RETRY_DELAY_MS: Delay between retries in milliseconds.

## API Examples

### Create an order

```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H 'Content-Type: application/json' \
  -d '{
    "internal_order_id": "ORD-1001",
    "courier_partner": "mock",
    "customer_details": {"name": "Jane"},
    "package_details": {"weight": 1.2}
  }'
```

### Track an order

```bash
curl http://localhost:3000/api/v1/orders/ORD-1001/track
```

### Cancel an order

```bash
curl -X POST http://localhost:3000/api/v1/orders/ORD-1001/cancel
```

### Bulk create orders

```bash
curl -X POST http://localhost:3000/api/v1/orders/bulk \
  -H 'Content-Type: application/json' \
  -d '[
    {"internal_order_id": "BULK-1", "courier_partner": "mock"},
    {"internal_order_id": "BULK-2", "courier_partner": "urbanebolt"}
  ]'
```

## How to Add a New Courier

1. Implement a new class in src/couriers/adapters that satisfies the adapter interface.
2. Register the adapter in the factory in src/couriers/courier-factory.service.ts.
3. Add any required environment variables.
4. Use the same unified DTO contract; no controller or business logic changes are required.

## Testing

Build verification:

```bash
npm run build
```

## Notes

- The current implementation uses the mock adapter by default for local development and the UrbaneBolt adapter for the first real integration path.
- The bulk endpoint returns immediately and processes the batch asynchronously in the background.
