### [2026-03-18] Pattern: PowerShell Redirection Encoding

**Context**: Creating files via terminal commands in Windows PowerShell.
**Issue**: The `>` redirection operator in PowerShell defaults to UTF-16LE, which many CLI tools (like ripgrep) fail to process as text.
**Solution**: Use the `write_to_file` tool for file creation when possible. If terminal redirection is necessary, use `write-output "content" | out-file -encoding utf8 filename` or explicit `-Encoding utf8` flags.
