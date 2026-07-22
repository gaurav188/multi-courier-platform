# Design Document

## Overview

The platform exposes one courier-agnostic API for order operations. Consumers send a normalized payload with a courier_partner field, while the backend selects the appropriate adapter at runtime.

## Architecture

The solution uses a classic layered NestJS structure:

- Controllers expose REST endpoints and validate incoming requests.
- Services contain business logic for idempotency, persistence, and tracking updates.
- A CourierFactory resolves the correct adapter based on the courier_partner value.
- Each adapter implements a small interface for create, track, and cancel operations.

This design follows the Strategy pattern. It keeps the unified API stable while allowing each courier integration to vary independently. New couriers can be added by introducing a new adapter and registering it in the factory, without changing controllers, DTOs, or the order service workflow.

## Data Model

The application persists two entities:

- Orders: stores the internal order ID, selected courier, courier-generated IDs, AWB, status, and request/response payloads.
- TrackingHistory: stores an append-only audit trail of status updates and payloads for each order.

## Bulk Processing Design

The bulk endpoint returns a batch ID immediately and processes the batch asynchronously. This keeps the HTTP request responsive even when many shipments must be created. Each order is processed independently, and the service records per-item success or failure results for later reconciliation.

## Error Handling

Errors are normalized into a consistent response shape and logged with the order ID, courier partner, request ID, and error type. Courier-specific failures are mapped to internal codes such as COURIER_BAD_REQUEST or COURIER_UNAVAILABLE.

## Trade-offs

- Using PostgreSQL for the core order and tracking tables keeps the system auditable and queryable.
- The current implementation uses a simple in-process batch result store for the bulk flow; a production deployment could replace this with a durable queue and result table.
- The UrbaneBolt adapter is configuration-driven and retry-aware, but the real endpoint remains stubbed behind environment-based settings for local execution.
