---
name: business-analyst
description: Specialist standards for requirement elicitation, stakeholder impact analysis, and ROI validation. Used by the strategist to justify project resources and validate the "Right to Exist."
argument-hint: "<problem statement or project idea>"
metadata:
  version: "1.0.0"
tags: ["business-analysis", "requirements", "strategy", "roi"]
verbosity_control: "STRICT. Focus on quantifiable business value and operational risk. No buzzwords."
---

# Skill: Business Analysis & Requirements Engineering

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
- **Compatibility**: Hardware constraints (e.g., "Must run on standard tablet hardware"), OS requirements, software dependencies.

### Operational Requirements
How the system fits into **existing workflows**:
- What tools does the user currently use? (Rhino, Power BI, Excel, manual?)
- At what point in the workflow does this tool get invoked?
- What data formats flow in and out? Who provides the input data?
- What training or documentation is required for adoption?
- What happens when the tool is unavailable? (Fallback procedure)

## 🔍 Risk & Feasibility Audit

### Data Risk
- Does the required data actually exist? Is it accessible?
- What format is it in? Does it require transformation?
- Who owns the data? Are there access restrictions or licensing issues?
- How fresh does the data need to be? Real-time, daily, seasonal?

### Adoption Risk
- Will the target users actually use this, or is it too complex for their current workflow?
- Does it require new software, hardware, or skills?
- Is there organizational appetite for process change?
- What is the minimum viable training path?

### Technical Risk
- Is the proposed solution technically feasible within the constraints (time, budget, hardware)?
- Are there dependencies on unstable or immature technologies?
- What is the "blast radius" if the tool produces incorrect results? (Safety-critical vs. advisory)

### Technical Debt Risk
- Is the proposed solution a "quick fix" that will break during the next season or project?
- Does it create maintenance burden that exceeds its value?
- Can it be extended or does it need to be rebuilt for the next use case?

## 🏗 Project Typing Input

The business analysis feeds directly into the `strategist`'s Step 0 `PROJECT_TYPE` classification:

| Business Need | Likely Project Type | Primary Skills Activated |
| :--- | :--- | :--- |
| Geometry optimization, sightlines, seating | `geometry` | `python-rhino-grasshopper`, `rhino-e2e-testing`, `csharp-grasshopper` |
| Analytics dashboard, KPI tracking | `data` | `dax-modeling` |
| Tool integration, API development | `code` | `typescript-mcp`, `python-patterns` |
| Book, report, editorial review | `manuscript` | `manuscript-review` |
| Multiple of the above | `hybrid` | Per-phase assignment |

## 🖋 Business Output (The Artifact)

When triggered, generate a `Artifacts/BRD_SUMMARY.md` (Business Requirements Document) with:

### THE VALUE PROPOSITION
- Single sentence on why this project is a priority for the organization.
- Quantified impact: dollars saved, time recovered, risk mitigated.

### STAKEHOLDER MAP
| Role | Name / Team | Influence | Needs |
| :--- | :--- | :--- | :--- |
| Owner | [who] | [high/medium/low] | [what they need from this project] |
| User | [who] | [high/medium/low] | [what they need from the tool] |
| Beneficiary | [who] | [high/medium/low] | [what they gain downstream] |
| Blocker | [who] | [high/medium/low] | [what concern must be addressed] |

### CRITICAL REQUIREMENTS
- **Must Have**: Top 3 functional requirements that define a successful delivery.
- **Should Have**: 2–3 enhancements that significantly increase value.
- **Won't Have**: Explicitly scoped-out items to prevent scope creep.

### ROI PROJECTION
| Factor | Estimate |
| :--- | :--- |
| Build effort | [hours/days/phases] |
| Operational time saved | [per use / per season] |
| Revenue impact | [if applicable] |
| Risk reduction | [compliance / safety] |
| Payback period | [when ROI turns positive] |

### RISKS & MITIGATIONS
| Risk | Likelihood | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| [risk] | [H/M/L] | [H/M/L] | [strategy] |

### OPERATIONAL FIT
- Current workflow insertion point.
- Required data sources and access status.
- Training and adoption plan.
- Fallback procedure if the tool is unavailable.

## 🏁 Completion Metrics

The `strategist` evaluates these before proceeding to `/blueprint`:

| Metric | Rating | Criteria |
| :--- | :--- | :--- |
| **Requirement Clarity** | High / Ambiguous / Lacking | Are all Must-Have requirements testable? |
| **Operational Fit** | Seamless / Friction-Heavy / Requires Process Change | Does it slot into existing workflows? |
| **Data Readiness** | Ready / Partial / Unavailable | Is the required data accessible and clean? |
| **Adoption Likelihood** | High / Medium / Low | Will users actually use this? |
| **ROI Confidence** | Strong / Moderate / Speculative | Is the value projection based on evidence or assumption? |

## 🎙 Interview Methodology (The Elicitation)

The `strategist` uses these high-density questions before Step 0 to eliminate "Requirement Debt":

### 1. The "Why Now" (Urgency)
- "What happens if we *don't* build this today? What is the cost of doing nothing for another month?"
- "Is this a response to a recent failure, a new mandate, or a long-standing inefficiency?"

### 2. The "Minimum Viable Win" (Minimalism)
- "If I could only deliver ONE feature from your list, which one makes the project a success? What can we strictly ignore for Phase 1?"
- "What is the absolute manual workaround we must beat to be useful?"

### 3. The "Work Flow Insertion" (Operational)
- "At what exact moment in your day do you open this tool? What data is in your hand (or on your screen) right then?"
- "Who is the first person to see the output of this tool, and what do they do with it?"

### 4. The "Blast Radius" (Risk)
- "If this tool produces a 5% error in its calculation, who gets fired / what breaks / how much money is lost?"
- "Are there any 'black box' dependencies or external approvals we don't control?"

**Standard**: Ask 3 questions from this list (or domain-specific variants) to anchor the Step 0 VALUE_CHECK.

**Primary Directive**: The single most critical business question that must be answered before coding starts. If this question cannot be answered, the project does not proceed.