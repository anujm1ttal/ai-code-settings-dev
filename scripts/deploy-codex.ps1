<# Deploy shared guidance to Codex without changing personal config or hooks. #>
param(
    [string]$DestinationRoot = (Join-Path $env:USERPROFILE '.codex'),
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents\skills')
)

$ErrorActionPreference = 'Stop'
$DestinationRoot = [System.IO.Path]::GetFullPath($DestinationRoot).TrimEnd('\', '/')
$SkillsRoot = [System.IO.Path]::GetFullPath($SkillsRoot).TrimEnd('\', '/')
$sourceRoot = Split-Path $PSScriptRoot -Parent
$backupRoot = Join-Path $DestinationRoot ('backups\ai-code-settings\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))

function Write-GuidanceFile {
    param([byte[]]$Bytes, [string]$Target)
    $parent = Split-Path $Target -Parent
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    if (Test-Path -LiteralPath $Target -PathType Leaf) {
        $old = [System.IO.File]::ReadAllBytes($Target)
        if ([System.Linq.Enumerable]::SequenceEqual([byte[]]$old, [byte[]]$Bytes)) { return }
        if ($Target.StartsWith($DestinationRoot + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
            $relative = Join-Path 'codex' ($Target.Substring($DestinationRoot.Length).TrimStart('\', '/'))
        } elseif ($Target.StartsWith($SkillsRoot + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
            $relative = Join-Path 'skills' ($Target.Substring($SkillsRoot.Length).TrimStart('\', '/'))
        } else {
            throw "Target is outside the Codex and skills destinations: $Target"
        }
        $backup = Join-Path $backupRoot $relative
        New-Item -ItemType Directory -Path (Split-Path $backup -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $Target -Destination $backup -Force
    }
    [System.IO.File]::WriteAllBytes($Target, $Bytes)
}

function Copy-GuidanceFile {
    param([string]$Source, [string]$Target)
    Write-GuidanceFile -Bytes ([System.IO.File]::ReadAllBytes($Source)) -Target $Target
}

function Copy-GuidanceTree {
    param([string]$Source, [string]$Target)
    Get-ChildItem -LiteralPath $Source -Recurse -File | ForEach-Object {
        $relative = $_.FullName.Substring($Source.Length).TrimStart('\', '/')
        Copy-GuidanceFile -Source $_.FullName -Target (Join-Path $Target $relative)
    }
}

Copy-GuidanceFile -Source (Join-Path $sourceRoot 'Codex-global.md') -Target (Join-Path $DestinationRoot 'AGENTS.md')
Copy-GuidanceTree -Source (Join-Path $sourceRoot 'rules') -Target (Join-Path $DestinationRoot 'rules')
Copy-GuidanceTree -Source (Join-Path $sourceRoot 'agents') -Target (Join-Path $DestinationRoot 'reference\agents')
# Keep Claude's Markdown model metadata intact for Claude Code. Generate a
# separate Codex agent fleet from the same role bodies with a known GPT model.
$codexModel = 'gpt-6-sol'
Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'agents') -Filter '*.md' -File |
    Where-Object { $_.BaseName -ne 'agents.overview' -and $_.BaseName -notlike '*.abstract' } |
    ForEach-Object {
        $source = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8)
        $frontmatter = [regex]::Match($source, '(?s)\A---\r?\n(.*?)\r?\n---\r?\n')
        if (-not $frontmatter.Success) { throw "Agent has no frontmatter: $($_.FullName)" }
        $header = $frontmatter.Groups[1].Value
        $name = [regex]::Match($header, '(?m)^name:\s*(.+)$').Groups[1].Value.Trim()
        $description = [regex]::Match($header, '(?m)^description:\s*(.+)$').Groups[1].Value.Trim()
        $effort = [regex]::Match($header, '(?m)^effort:\s*(.+)$').Groups[1].Value.Trim()
        if (-not $name -or -not $description -or $effort -notin @('low', 'medium', 'high', 'xhigh')) {
            throw "Agent has incomplete Codex metadata: $($_.FullName)"
        }
        $instructions = $source.Substring($frontmatter.Length).Trim()
        $instructions = "This is a Codex agent. Use the GPT model configured in this TOML; legacy Claude model-tier references in the role guidance do not select a model here.`n`n" + $instructions
        $content = "name = $(ConvertTo-Json -InputObject $name -Compress)`n" +
            "description = $(ConvertTo-Json -InputObject $description -Compress)`n" +
            "model = $(ConvertTo-Json -InputObject $codexModel -Compress)`n" +
            "model_reasoning_effort = $(ConvertTo-Json -InputObject $effort -Compress)`n" +
            "developer_instructions = $(ConvertTo-Json -InputObject $instructions -Compress)`n"
        $target = Join-Path (Join-Path $DestinationRoot 'agents') ($name + '.toml')
        Write-GuidanceFile -Bytes ([System.Text.UTF8Encoding]::new($false).GetBytes($content)) -Target $target
    }
Copy-GuidanceTree -Source (Join-Path $sourceRoot 'commands') -Target (Join-Path $DestinationRoot 'reference\commands')
Copy-GuidanceTree -Source (Join-Path $sourceRoot 'skills') -Target $SkillsRoot
Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'hooks') -Recurse -File |
    Where-Object { $_.Extension -eq '.js' -or $_.Name -in @('license-gate.json', 'backlog-caps.json') } |
    ForEach-Object {
        $relative = $_.FullName.Substring((Join-Path $sourceRoot 'hooks').Length).TrimStart('\', '/')
        Copy-GuidanceFile -Source $_.FullName -Target (Join-Path (Join-Path $DestinationRoot 'hooks') $relative)
    }

# Codex invokes reusable workflows as skills. Preserve every command as a
# discoverable skill while keeping the Markdown command source canonical.
Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'commands') -Filter '*.md' -File | ForEach-Object {
    $name = 'source-command-' + $_.BaseName
    $body = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8)
    $frontmatter = [regex]::Match($body, '(?s)\A---\r?\n.*?\r?\n---\r?\n')
    if (-not $frontmatter.Success) { throw "Command has no frontmatter: $($_.FullName)" }
    $descriptionMatch = [regex]::Match($frontmatter.Value, '(?m)^description:\s*(.+)$')
    if (-not $descriptionMatch.Success) { throw "Command has no description: $($_.FullName)" }
    $description = $descriptionMatch.Groups[1].Value.Trim().Trim('"')
    $quotedDescription = ConvertTo-Json -InputObject $description -Compress
    $procedure = $body.Substring($frontmatter.Length)
    $content = "---`nname: $name`ndescription: $quotedDescription`n---`n`n# $name`n`nUse this skill when the user requests the migrated '$($_.BaseName)' workflow. Apply the procedure with Codex tools and approval rules. The Codex agent TOML selects the GPT model; legacy Claude model-tier references in the procedure do not select a model.`n`n" + $procedure
    $target = Join-Path $SkillsRoot ($name + '\SKILL.md')
    Write-GuidanceFile -Bytes ([System.Text.UTF8Encoding]::new($false).GetBytes($content)) -Target $target
}

Write-Output "Codex guidance deployed to $DestinationRoot; skills deployed to $SkillsRoot"
