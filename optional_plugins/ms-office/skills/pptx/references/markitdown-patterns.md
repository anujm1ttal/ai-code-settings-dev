# Reference: MarkItDown Patterns for PPTX

This document defines the patterns for extracting and analyzing PPTX content using the `markitdown` tool.

## 🔍 Content Extraction

### Basic Extraction
Extract all text and structural markers from a presentation:
```bash
python -m markitdown presentation.pptx
```

### Batch Extraction
Extract from multiple files for comparison or summarization:
```bash
ls *.pptx | xargs -I {} python -m markitdown {} > extracted_content.md
```

## 🛠 Analysis Workflows

### Placeholder Detection
Search for common template placeholders that need replacement:
```bash
python -m markitdown presentation.pptx | grep -iE "xxxx|lorem|ipsum|this.*(page|slide).*layout|[A-Z]{2,}"
```

### Content Inventory
Use the extracted markdown to create a structured content inventory:
1. Run `markitdown`.
2. Analyze slide headings (`# Slide 1: ...`).
3. Verify bullet point consistency across slides.

### LLM Context Preparation
When providing a presentation to an LLM for summarization or rewrite, always use the `markitdown` output as the source of truth for text content.
