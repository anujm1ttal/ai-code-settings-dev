# MCP Planning Checklist (Strategic)

Before implementing a Python MCP server, complete this checklist to ensure architectural alignment.

## 1. Naming Conventions

- **Server Name**: `{service}_mcp` (lowercase, snake_case).
- **Tool Names**: `{service}_{action}` (e.g., `github_create_issue`).
- **Input Fields**: Use domain-aligned terms (e.g., `owner` and `repo` instead of `param1`, `param2`).

## 2. Tool Surface Selection

- **Atomic vs. Orchestrated**: 
    - Atomic: `slack_send_message`
    - Orchestrated: `slack_create_channel_and_invite_user`
    - **Rule**: Prioritize orchestrated tools if the workflow is recurring and complex.
- **Read/Write Balance**:
    - Every "Write" tool should have a corresponding "Read" tool for verification (e.g., `create_item` -> `get_item_details`).

## 3. API Discovery

- [ ] Identify Base URL and authentication scheme (Bearer, API Key, OAuth).
- [ ] Map error codes (404, 401, 403, 429) to user-friendly strings.
- [ ] Identify rate limits and pagination strategies.

## 4. Context Optimization

- **Summarization**: Do not return 100 fields if only 5 are needed for the agent's next step.
- **Identifiers**: Return IDs that can be passed to subsequent tools.
- **Markdown**: Use headers and lists to make the response "scannable" for the LLM.

## 5. Security Invariants

- [ ] Secrets (API Keys) must come from Environment Variables, never hardcoded.
- [ ] Validate input length and patterns to prevent injection.
- [ ] Scrape/sanitize HTML if returning content from external sites.
