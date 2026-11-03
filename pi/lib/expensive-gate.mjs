export function createExpensiveGate() {
  let current;
  return {
    tryAcquire(label) {
      if (current !== undefined) throw new Error(`Another expensive operation is active: ${current.label}`);
      const owner = { label };
      current = owner;
      return () => { if (current === owner) current = undefined; };
    },
    active() { return current?.label; },
  };
}

export async function withExpensiveGate(gate, label, fn) {
  const release = gate.tryAcquire(label);
  let hold = false;
  try { return await fn(); }
  catch (error) {
    // Like a quarantined background job: an unconfirmed child cleanup keeps the gate held for the session.
    hold = /cleanup unconfirmed/i.test(error instanceof Error ? error.message : String(error));
    throw error;
  }
  finally { if (!hold) release(); }
}
