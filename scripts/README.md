# Utility Scripts

Utility scripts used by commands and agents.

## `manifest_validator.py`

Validates and analyzes `project.json` manifests.

**Usage**:
```bash
python scripts/manifest_validator.py /path/to/project [--export]
```

**Features**:
- Schema validation against `templates/project.schema.json`
- Cross-references declared skills with actual registry
- Detects redundant declarations
- Calculates token savings
- Generates optimization recommendations
- Exports reports to `Artifacts/Temp/`

**Used by**: `/manifest` command (concierge workflow)

**Output**:
- Validation status (errors/warnings)
- Effective skill list
- Token analysis
- Recommendations for optimization

### Example

```bash
# Validate and analyze manifest
python scripts/manifest_validator.py .

# Export report for auditing
python scripts/manifest_validator.py . --export
```

Exit code: 0 if valid, 1 if invalid.
