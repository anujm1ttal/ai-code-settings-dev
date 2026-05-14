# FastMCP Implementation Patterns (Python)

Tactical code standards for building high-rigor MCP servers using the `mcp` Python SDK and Pydantic v2.

## 🚀 Server Initialization

Standard pattern for server setup:

```python
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
import httpx
import json

# Initialize the MCP server
mcp = FastMCP("service_name_mcp")

# Constants
API_BASE_URL = "https://api.service.com/v1"
```

## 🛡️ Input Modeling (Pydantic v2)

Always use `BaseModel` with `ConfigDict`.

```python
class ToolInput(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,  # Mandatory for clean inputs
        validate_assignment=True,   # Ensure persistence of validation
        extra='forbid'              # Prevent shadow parameters
    )

    id: str = Field(..., description="Unique identifier (e.g., 'usr_123')", pattern=r"^[a-z]{3}_[0-9]+$")
    limit: Optional[int] = Field(20, description="Page limit", ge=1, le=100)
```

## 🛠️ Tool Registration

Use `@mcp.tool` with full annotations.

```python
@mcp.tool(
    name="service_action_name",
    annotations={
        "title": "Human Readable Title",
        "readOnlyHint": True,      # Set False for writes
        "destructiveHint": False, # Set True for deletes
        "idempotentHint": True     # Set False for non-repeatable actions
    }
)
async def service_action_name(params: ToolInput) -> str:
    '''Verbose description of the tool's purpose and side effects.
    
    Args:
        params (ToolInput): Validated inputs.
    '''
    try:
        # Implementation...
        pass
    except Exception as e:
        return _handle_error(e)
```

## 📝 Response Formatting

### Markdown (Human)
Optimize for readability in the agent's context.
- Use `## Headers` for primary entities.
- Use `- Bullet points` for lists.
- Avoid deep nesting.

### JSON (Machine)
Provide raw data for downstream tool chaining.
- Use `json.dumps(data, indent=2)`.

## ⚠️ Error Handling

Centralize error formatting to ensure actionable messages.

```python
def _handle_error(e: Exception) -> str:
    if isinstance(e, httpx.HTTPStatusError):
        if e.response.status_code == 404:
            return "Error: Resource not found. Verify the ID and try again."
        if e.response.status_code == 429:
            return "Error: Rate limited. Retry in X seconds."
    return f"Error: Unexpected failure: {str(e)}"
```

## 🏗️ Common Utilities

- **Shared Client**: Use `httpx.AsyncClient()` as an async context manager or in `app_lifespan`.
- **Pagination**: Standardize on `limit`/`offset` or `cursor`.
- **Validation**: Use `@field_validator` for cross-field logic.
