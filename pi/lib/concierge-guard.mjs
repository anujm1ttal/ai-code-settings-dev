const READABLE_TOOLS = new Set(['read', 'grep', 'find', 'ls']);

// Tool-level boundary only; this is not an operating-system sandbox.
export function conciergeToolDenial(_projectRoot, toolName, _input) {
  return READABLE_TOOLS.has(toolName) ? undefined : 'Concierge tool is not allowlisted';
}
