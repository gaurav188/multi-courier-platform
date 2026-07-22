const test = require('node:test');
const assert = require('node:assert/strict');
const { CourierFactory } = require('../dist/couriers/courier-factory.service.js');

test('CourierFactory exposes supported couriers', () => {
  const factory = new CourierFactory({});
  const couriers = factory.getSupportedCouriers();
  assert.ok(couriers.includes('urbanebolt'));
  assert.ok(couriers.includes('mock'));
});
