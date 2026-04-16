# MCP Zod Validation Patterns

> Load this on-demand when designing tool input schemas or complex data validation.

## 🛡 Mandatory Patterns

### 1. Document Everything
Use `.describe()` on every field. This generates the documentation the AI Sees.
```typescript
export const SeatingSchema = z.object({
  sectionId: z.string().describe("The UUID of the section to analyze"),
  minCValue: z.number().default(60).describe("The minimum C-Value threshold for compliance")
});
```

### 2. Strict Objects
Always use `.strict()` to prevent the AI from passing hallucinated parameters.
```typescript
export const ToolSchema = z.object({ ... }).strict();
```

### 3. Branded Types for Safety
Use Zod branding to prevent passing raw strings/numbers where specific domain types are required.
```typescript
const RhinoGuid = z.string().uuid().brand<"RhinoGuid">();
```

## 🧩 Complex Types

### Enums
Use `z.nativeEnum()` with the `as const` pattern.
```typescript
export const Resolution = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high"
} as const;

export const ResolutionSchema = z.nativeEnum(Resolution);
```

### Optional & Nullable
- Use `.optional()` for parameters that have defaults.
- Use `.nullable()` ONLY if the external system explicitly supports `null`. Default to `undefined` for tool inputs.

## 🧪 Validation Helpers
- Use `.refine()` for business logic validation (e.g., `min < max`).
- Use `.transform()` to convert raw inputs (ISO strings → Date objects) before they reach the handler.
