#!/usr/bin/env node
/**
 * Test-only harness for hooks/lib/evidence.js's matchCompletionClaim — proves
 * the negation/question exclusion contract (LH-2 T1) at the unit level,
 * independent of the six transcript fixtures.
 *
 * stdin: JSON array of strings. stdout: JSON array of booleans (claim matched?).
 */

'use strict';

const { matchCompletionClaim } = require('../../hooks/lib/evidence');

const input = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
const results = input.map((text) => matchCompletionClaim(text) !== null);
process.stdout.write(JSON.stringify(results));
