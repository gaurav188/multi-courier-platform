const test = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('class-validator');
const { CreateOrderDto } = require('../dist/common/dtos/create-order.dto.js');

test('CreateOrderDto rejects missing internal_order_id and courier_partner', async () => {
  const dto = new CreateOrderDto();
  dto.customer_details = { name: 'Jane' };
  const errors = await validate(dto);
  assert.ok(errors.some((error) => error.property === 'internal_order_id'));
  assert.ok(errors.some((error) => error.property === 'courier_partner'));
});
