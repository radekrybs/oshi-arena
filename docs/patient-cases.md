# Patient Cases: De-identification & Tiered-Intelligence Solving

> **Status:** Design specification (v0.1) — open for community feedback.
> **License:** Apache 2.0. Everything described here ships open source.
> **Safety note:** This document describes a system that handles real medical
> records *before* de-identification. Intake does **not** open until the secure,
> audited pipeline below is implemented and reviewed. Nothing here is medical advice.

## 1. What this feature does

A person with an **unsolved medical issue** can upload or securely link their records.
OSHI Arena:

1. **De-identifies** the records with an open-source pipeline (**OSHI-DEID**) so no raw
   PHI is ever exposed to the community.
2. Lets an open-source **Default OSHI Agent** attempt the case; if it is confident, the
   answer is returned (after clinician review).
3. If not, an **orchestrator** escalates — convening specialist agents and adding compute
   **only as needed**, layer by layer — until the case is resolved or routed to humans.

The guiding principle: **just-in-time intelligence.** Each additional layer of reasoning
and compute is added only when the previous layer cannot resolve the case with confidence.

---

## 2. Reconciling with the "no PHI" principle

OSHI Arena's challenges use **public / synthetic data only**. Patient Cases is the one
place real data enters — and it is reconciled by a hard invariant:

> **Invariant:** The community of humans and agents only ever sees **de-identified**
> data. Raw PHI never leaves the secure intake boundary.

Raw uploads live in an isolated, encrypted **intake enclave**. Only the de-identification
service can read them; only its de-identified output crosses into the collaboration plane.

---

## 3. OSHI-DEID — open-source de-identification pipeline

There is no single off-the-shelf tool that de-identifies free text, structured data, and
medical images to a clinical standard. OSHI-DEID is a **curated, auditable pipeline** that
composes best-in-class open-source components and adds the glue, evaluation, and policy
layer the arena needs. Where gaps exist, OSHI Arena builds and open-sources the missing
piece.

### 3.1 Standards we target

- **HIPAA Safe Harbor** — remove the 18 enumerated identifier categories (names, geographic
  subdivisions smaller than a state, all date elements finer than year for people 89+, contact
  details, IDs, biometric identifiers, full-face photos, etc.).
- **HIPAA Expert Determination** — a statistical re-identification-risk assessment for cases
  where Safe Harbor is too lossy to keep the record clinically useful.
- Alignment with **GDPR** anonymization/pseudonymization concepts for non-US contributors.

### 3.2 Modalities & approach

| Modality | Approach | Candidate open-source building blocks |
| --- | --- | --- |
| Free-text notes | NER + rule/context detection of PHI spans, then redact/replace/surrogate | Microsoft **Presidio**, **Philter**, MITRE **MIST**, NLM **Scrubber** |
| Structured fields | Schema-aware column policies (drop, hash, generalize, date-shift) | Custom + Presidio anonymizers |
| Dates | Consistent per-record **date shifting** to preserve intervals without real dates | Custom (date-jitter with per-subject offset) |
| DICOM imaging | Strip/standardize header metadata; detect burned-in pixel text | RSNA **CTP** (Clinical Trial Processor), **pydicom**, **dcm4che** |
| Image pixels | OCR-based burned-in-text detection + masking; face/landmark removal | OCR (e.g. Tesseract) + detectors |
| PDFs/scans | OCR → treat as free text → re-render redacted | OCR + text pipeline |

### 3.3 Pipeline stages

```
intake enclave (encrypted)
        │
        ▼
1. Ingest & classify        → detect modality, route to handlers
2. Detect identifiers       → NER + rules + context (ensemble, recall-tuned)
3. Transform                → redact / hash / generalize / surrogate / date-shift
4. Risk assessment          → Safe Harbor checklist + Expert-Determination risk score
5. Human-in-the-loop QA     → reviewer confirms before release (esp. low-confidence spans)
6. Audit & manifest         → signed record of what was removed + reproducible config
        │
        ▼
collaboration plane (de-identified only)
```

### 3.4 Design principles

- **Recall over precision for detection.** Missing PHI is far worse than over-redacting;
  thresholds favor catching identifiers, with surrogate generation to retain utility.
- **Defense in depth.** Multiple detectors (statistical + rule-based) in an ensemble;
  a single model miss should not leak PHI.
- **Human QA gate for release.** Especially while models mature, a reviewer confirms before
  any case is published — analogous to the Tier N clinician gate on the solving side.
- **Reproducible & signed.** Every de-identification run emits a manifest (config hash,
  component versions, decisions) so it can be audited and reproduced.
- **Benchmarked openly.** We publish an evaluation harness measuring recall/precision on
  public de-identification benchmarks (e.g. i2b2/n2c2 de-id corpora) and synthetic test sets —
  never on real patient data.

### 3.5 Open build items (where OSHI Arena adds new OSS)

- A unified, policy-driven **orchestrator** across text/structured/imaging modalities.
- Burned-in **pixel-text + face** detection tuned for clinical images.
- A reusable **re-identification risk scorer** for Expert Determination.
- A public **de-id evaluation leaderboard** (this is itself a great inaugural challenge).

---

## 4. Tiered-intelligence solving

Once a case is de-identified, it enters the solving loop. Compute escalates only as needed.

### Tier 0 — Default OSHI Agent
A fast, fully open-source baseline agent reviews the case and produces a candidate answer
**with a calibrated confidence score**. If confidence ≥ threshold **and** the case is
low-risk, it proceeds to clinician review (Tier N) and can be returned quickly.

### Tier 1 — Specialist agents convened
If confidence is low, an **orchestrator** decomposes the case and routes sub-problems to
domain agents (e.g. imaging, genomics, pharmacology, rare disease). Their findings are
merged and re-scored.

### Tier 2 — Deep expertise, tools & compute
Still unresolved? Specialists recruit sub-specialist agents and tools — literature
retrieval, guideline lookup, differential-diagnosis reasoning, heavier compute — sized to
the difficulty of the case.

### Tier N — Human clinician review (always)
Qualified clinicians verify results **before anything reaches the patient**. Humans are in
the loop on every case; the patient receives **decision support**, not a diagnosis, framed
to discuss with their own care team.

### 4.1 Escalation policy

- **Confidence gating.** Each tier emits a calibrated confidence + uncertainty. Escalate when
  below threshold; thresholds are conservative for high-acuity cases.
- **Just-in-time compute.** No tier is invoked unless the prior tier failed to resolve —
  keeping common cases cheap and reserving heavy compute for genuinely hard ones.
- **Cost & latency budgets.** The orchestrator tracks compute spent so escalation is
  transparent and bounded.
- **Provenance & explainability.** Every step records which agents/tools contributed and why,
  producing an auditable reasoning trail for clinician review.
- **Safety stops.** Red-flag / emergency patterns trigger an immediate "seek urgent care"
  message and route to humans — never a slow escalation.

### 4.2 Sketch

```
de-identified case
   │
   ▼
[Tier 0] Default OSHI Agent ──(confident & low-risk)──► [Tier N] clinician review ─► patient
   │ (low confidence)
   ▼
[Tier 1] Orchestrator → specialist agents ──(resolved)──► [Tier N] ─► patient
   │ (still unresolved)
   ▼
[Tier 2] sub-specialists + tools + compute ──► [Tier N] ─► patient
   │
   └─ red flags at any point → urgent-care guidance + human routing
```

---

## 5. Governance, ethics & safety

- **Consent-first.** Patients explicitly consent to what is shared and can withdraw. Clear,
  plain-language explanation of de-identification and its residual risks.
- **Not medical advice.** Output is research/decision-support, clinician-reviewed, intended
  for discussion with the patient's own care team.
- **Clinical oversight.** Licensed clinicians govern the review process and red-flag handling.
- **Bias & fairness auditing.** Agents and the de-id pipeline are evaluated across
  demographic strata; fairness is a first-class metric, consistent with the arena's challenges.
- **Open & auditable.** De-identification and orchestration code are open source and emit
  signed audit trails so the community can inspect, reproduce, and improve them.
- **Regulatory awareness.** Clinical decision-support and de-identification carry regulatory
  obligations (HIPAA, GDPR, and possibly medical-device rules). This needs qualified legal and
  clinical review before any real-patient intake is enabled.

---

## 6. Roadmap

1. **De-id evaluation challenge** — launch open benchmarking of OSHI-DEID on public/synthetic
   corpora (no real data). Establishes trust before any intake.
2. **Synthetic case pilot** — run the full tiered-intelligence loop end-to-end on synthetic
   patient cases.
3. **Secure intake enclave** — encrypted upload, consent flows, human QA gate.
4. **Clinician review network** — onboard licensed reviewers and red-flag protocols.
5. **Limited real-case pilot** — only after security, clinical, and legal review sign-off.

---

## 7. How to contribute

This is an open design — feedback and contributions welcome on the
[OSHI Arena GitHub org](https://github.com/oshi-arena). High-value early areas: the de-id
evaluation harness, burned-in pixel-text detection, confidence calibration for the Default
OSHI Agent, and the escalation orchestrator.

*This is a living document and will evolve with the project.*
