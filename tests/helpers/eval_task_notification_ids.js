#!/usr/bin/env node
/**
 * Test-only harness for hooks/lib/evidence.js's extractTaskNotificationToolUseIds
 * — proves the SGH-1c D4 barrier's signal extraction at the unit level,
 * independent of the task-diff-guard.js Stop-hook subprocess contract.
 *
 * stdin: JSON array of "entries" arrays (one per case; a case may be any
 * value, including garbage, to prove the no-throw contract).
 * stdout: JSON array of string[] — extractTaskNotificationToolUseIds(entries)
 * per case, in the same order.
 */

'use strict';

const { extractTaskNotificationToolUseIds } = require('../../hooks/lib/evidence');

const cases = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
const results = cases.map((entries) => extractTaskNotificationToolUseIds(entries));
process.stdout.write(JSON.stringify(results));
