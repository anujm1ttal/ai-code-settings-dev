### [2026-04-30] Anti-Pattern: Artifact Path Validation

**Context**: Creating or updating system artifacts using the `IsArtifact: true` flag.
**Issue**: The platform enforces strict absolute pathing for artifacts within the AI's "brain" directory. Using relative paths or workspace-absolute paths for brain-stored artifacts causes failures.
**Solution**: Always use the absolute path provided in the `App Data Directory` and `Conversation ID` metadata to construct the target path for any file where `IsArtifact` is set to `true`.
