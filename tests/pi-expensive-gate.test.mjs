import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';

const file = new URL('../pi/lib/expensive-gate.mjs', import.meta.url);
async function gateModule() {
  assert.ok(existsSync(file), 'expensive gate module must exist');
  return import(file.href);
}

test('gate excludes a second operation and releases idempotently', async () => {
  const { createExpensiveGate } = await gateModule();
  const gate = createExpensiveGate();
  assert.equal(gate.active(), undefined);
  const release = gate.tryAcquire('first');
  assert.equal(gate.active(), 'first');
  assert.throws(() => gate.tryAcquire('second'), /Another expensive operation is active: first/);
  release();
  const release2 = gate.tryAcquire('second');
  release();
  assert.equal(gate.active(), 'second');
  release2();
  assert.equal(gate.active(), undefined);
});

test('an unconfirmed child cleanup keeps the gate held, like a quarantined background job', async () => {
  const { createExpensiveGate, withExpensiveGate } = await gateModule();
  const gate = createExpensiveGate();
  await assert.rejects(withExpensiveGate(gate, 'sync auditor', async () => {
    throw new Error('Agent dispatch aborted; cleanup unconfirmed: child did not close after forced termination');
  }), /cleanup unconfirmed/);
  assert.equal(gate.active(), 'sync auditor');
  assert.throws(() => gate.tryAcquire('next'), /Another expensive operation is active: sync auditor/);
});

test('withExpensiveGate releases on success and throw', async () => {
  const { createExpensiveGate, withExpensiveGate } = await gateModule();
  const gate = createExpensiveGate();
  assert.equal(await withExpensiveGate(gate, 'ok', async () => 42), 42);
  await assert.rejects(withExpensiveGate(gate, 'failure', async () => { throw new Error('boom'); }), /boom/);
  assert.equal(gate.active(), undefined);
});
