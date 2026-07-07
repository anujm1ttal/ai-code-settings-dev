---
name: business-analyst
description: Use this skill whenever you are eliciting requirements, mapping stakeholder impact, or validating ROI to justify a project's resources and "Right to Exist." Trigger when the strategist needs quantifiable cost-benefit justification, is stress-testing assumed benefits, or is preparing a Step 0 business case. Do NOT use for narrative/editorial review — use manuscript-review for developmental editing tasks instead.
argument-hint: "<problem statement or project idea>"
metadata:
  version: "1.0.1"
  tags: ["business-analysis", "requirements", "strategy", "roi", "stakeholder-analysis"]
  verbosity_control: "STRICT. Focus on quantifiable business value and operational risk. No buzzwords."
---


# Skill: Business Analysis & Requirements Engineering

## ROI Calculator Template

Use the bundled `assets/roi-calculator.md` for comprehensive cost-benefit justification. It includes:
- Implementation and ongoing operational cost analysis
- Quantifiable and qualitative benefit assessment
- ROI calculations and payback period
- Sensitivity analysis (what-if scenarios)
- Risk assessment with mitigation strategies
- Alternative options comparison
- Success metrics and stakeholder engagement plan

This template enforces structured financial discipline and prevents vague "assumed benefits."

---

## Deep-Load Protocol
Load reference files ONLY when the following conditions are met:

| File | Load When |
|:---|:---|
| `references/output-standards.md` | Before generating the BRD_SUMMARY or validating completion metrics |
| `references/elicitation-guide.md` | Before conducting a stakeholder interview or eliciting requirements |

## ⚖️ Step 0: The Business Case
Before any architecture is drawn, the `strategist` must validate the project's "Right to Exist":

### 1. The Problem Statement
- What specific operational pain or cost is being addressed?
- Who experiences this pain? How frequently? What is the current workaround?
- If the problem disappeared tomorrow, what measurable improvement would the organization see?

### 2. Success Metric (Business)
- Quantifiable target tied to operational outcomes:
  - Revenue: "Recover 10% of lost seating revenue through optimized sightlines."
  - Efficiency: "Reduce stadium ingress modeling time from 3 days to 2 hours."
  - Quality: "Achieve C-Value ≥ 90mm for 100% of premium seating."
  - Compliance: "Pass FIFA/UEFA sightline audit with zero non-conformances."
- **Forbidden**: Vague targets like "improve workflow" or "better analytics."

### 3. Stakeholder Map
- **Owner** (Decision-maker): Who approves the project and defines success?
- **User** (Operator): Who will use the tool day-to-day? What is their technical level?
- **Beneficiary** (Downstream): Who benefits from the output without directly using the tool?
- **Blocker** (Risk): Who could derail adoption (IT, procurement, change-averse staff)?

## 📋 Requirements Framework (The 3 Pillars)

### Functional Requirements
What the system must **do**:
- Core capabilities expressed as testable statements.
- Format: "The system shall [action] [object] [constraint]."
- Example: "The system shall calculate C-Values for 50,000 seats in under 2 minutes."
- Prioritize using MoSCoW: **Must**, **Should**, **Could**, **Won't** (this version).

### Non-Functional Requirements
How the system must **perform**:
- **Performance**: Response times, throughput, data refresh rates.
- **Scalability**: Maximum seat count, concurrent users, model complexity.
- **Reliability**: Acceptable failure rate, recovery time, data backup.
- **Security**: Access control, data sensitivity, audit trail requirements.
- **Compatibility**: Hardware constraints, OS requirements, software dependencies.

### Operational Requirements
How the system fits into **existing workflows**:
- What tools does the user currently use? (Rhino, Power BI, Excel, manual?)
- At what point in the workflow does this tool get invoked?
- What data formats flow in and out? Who provides the input data?
- What training or documentation is required for adoption?

## 🔍 Risk & Feasibility Audit

### Data Risk
- Does the required data actually exist? Is it accessible?
- What format is it in? Does it require transformation?
- Who owns the data? Are there access restrictions or licensing issues?

### Adoption Risk
- Will the target users actually use this, or is it too complex for their current workflow?
- Does it require new software, hardware, or skills?
- Is there organizational appetite for process change?

### Technical Risk
- Is the proposed solution technically feasible within the constraints (time, budget, hardware)?
- Are there dependencies on unstable or immature technologies?
- What is the "blast radius" if the tool produces incorrect results?

### Technical Debt Risk
- Is the proposed solution a "quick fix" that will break during the next season or project?
- Does it create maintenance burden that exceeds its value?

## 🏗 Project Typing Input

The business analysis feeds directly into the `strategist`'s Step 0 `PROJECT_TYPE` classification:

| Business Need | Likely Project Type | Primary Skills Activated |
| :--- | :--- | :--- |
| Geometry optimization, sightlines, seating | `geometry` | `python-rhino-grasshopper`, `rhino-e2e-testing` |
| Analytics dashboard, KPI tracking | `data` | `dax-modeling` |
| Tool integration, API development | `code` | `typescript-mcp`, `python-patterns` |
| Book, report, editorial review | `manuscript` | `manuscript-review` |
| Multiple of the above | `hybrid` | Per-phase assignment |

## 🖋 Business Output (The Artifact)
Standardized output requirements and completion metrics are defined in [output-standards.md](references/output-standards.md).

## 🎙 Interview Methodology (The Elicitation)
High-density elicitation questions and strategy are defined in [elicitation-guide.md](references/elicitation-guide.md).

**Primary Directive**: The single most critical business question that must be answered before coding starts. If this question cannot be answered, the project does not proceed.