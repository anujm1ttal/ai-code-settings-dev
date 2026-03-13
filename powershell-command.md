$s="C:\Users\44547\source\repos\ai-code-settings"; $d="$HOME\.claude"; "agents","commands","rules","skills" | % { rm "$d\$_" -Recurse -EA SilentlyContinue }; cp "$s\agents","$s\commands","$s\rules","$s\skills" "$d\" -Recurse -Force; cp "$s\CLAUDE.md" "$d\" -Force



$s="C:\Users\44547\source\repos\ai-code-settings"; $d="$HOME\.gemini\antigravity"; "agents","global_workflows","skills" | % { rm "$d\$_" -Recurse -EA SilentlyContinue }; cp "$s\agents","$s\skills" "$d\" -Recurse -Force; cp "$s\commands" "$d\" -Recurse -Force; Rename-Item -Path "$d\commands" -NewName "global_workflows" -Force; cp "$s\GEMINI.md" "$HOME\.gemini\" -Force
