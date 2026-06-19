# OSHI Grid: Volunteer Distributed Computing for Open Healthcare AI

> **Status:** Design specification (v0.1) — open for community feedback.
> **License:** Apache 2.0. Everything described here ships open source.
> **Heritage:** Inspired by **SETI@home** and built on the same lineage of open
> volunteer-computing infrastructure (**BOINC**, **Folding@home**) — adapted for the
> stricter privacy demands of healthcare data.

## 1. What this feature does

**OSHI Grid** lets anyone donate spare compute — a laptop, a gaming GPU, a homelab, a
cloud credit — to power open healthcare AI. Volunteers sign up, pick a **goal** to support,
and a coordinator hands their device small **work units** to process. Results are validated
and **reassembled** into finished artifacts: trained models, benchmark scores, de-identified
dataset batches, or compute for solving patient cases.

It is SETI@home for medicine — but because the payloads can be derived from health data, the
defining constraint is privacy, not throughput.

```
   Coordinator                Volunteers (the grid)              Coordinator
 ┌────────────┐   shard /    ┌─────┐ ┌─────┐ ┌─────┐   return    ┌────────────┐
 │  job/goal  │ ──────────►  │ vol │ │ vol │ │ vol │ ─────────►  │ validate + │
 │  splitter  │  dispatch    │  A  │ │  B  │ │  C  │  partials   │ reassemble │
 └────────────┘              └─────┘ └─────┘ └─────┘             └────────────┘
       scatter                   compute locally                   gather/reduce
```

## 2. The core invariant (why this isn't just SETI@home)

SETI@home shipped raw radio data to volunteers because that data carried no personal risk.
Health-derived data does. So OSHI Grid is governed by a hard rule:

> **Invariant:** A volunteer node never receives raw or individually-reconstructable health
> data. It only ever sees one of: (a) public/synthetic data, (b) cryptographic **shares**
> that are meaningless in isolation, (c) **ciphertext** it computes on without decrypting, or
> (d) a **model/task** that runs against data which never leaves its trusted source.

De-identification (OSHI-DEID) is necessary but **not sufficient** — distribution to untrusted
machines demands a second, cryptographic layer on top.

## 3. Data-sensitivity tiers (what's eligible for the grid)

| Tier | Data | Distribution method | Volunteer sees |
| --- | --- | --- | --- |
| **A — Open** | Public / synthetic datasets | Classic BOINC-style work units | The data (it's already public) |
| **B — Aggregate** | De-identified, used only for aggregate learning | **Federated learning** + secure aggregation + differential privacy | Model + its own shard's gradients only |
| **C — Sensitive** | De-identified but re-identification-sensitive | **Secret sharing + MPC**, **homomorphic encryption**, or **TEE** with attestation | Meaningless shares / ciphertext only |
| **D — Restricted** | Anything not safely protectable | **Not distributed** — stays in trusted cloud | Nothing |

**Launch on Tier A.** It carries no privacy risk, proves the grid mechanics end-to-end, and
delivers immediate value (e.g., training/eval for the public-data challenges). Tiers B and C
unlock as the privacy stack is built and audited. Tier D never leaves trusted infrastructure.

## 4. Privacy-preserving computation toolkit

The method is chosen per job by its tier:

- **Shamir / additive secret sharing + Secure Multiparty Computation (MPC).** Split each
  value into `n` shares; any `k-1` reveal nothing. Volunteers compute on shares; only the
  coordinator (with `k` shares) can reconstruct. Candidate OSS: **MP-SPDZ**, **tf-encrypted**.
- **Federated learning.** Ship the model to the data, not the data to the grid. Volunteers
  (or edge data holders) return gradients, combined with **secure aggregation** so the server
  never sees an individual update, plus **differential privacy** noise. OSS: **Flower**,
  **PySyft**, **Opacus**.
- **Homomorphic encryption (HE).** Compute directly on encrypted data for suitable workloads.
  OSS: **Microsoft SEAL**, **TenSEAL**, **OpenFHE**.
- **Trusted Execution Environments (TEEs).** For volunteers with capable hardware (Intel SGX,
  AMD SEV, confidential GPUs), run inside an enclave with **remote attestation** verifying the
  exact signed code before any data is released to it.
- **Differential privacy** on all released aggregates as a backstop against reconstruction.

## 5. Work-unit lifecycle (scatter → compute → gather → reassemble)

1. **Split / shard.** The coordinator decomposes a job into work units sized to volunteer
   capability, applying the tier-appropriate transform (chunk, secret-share, encrypt, or
   wrap as a federated task). Each unit gets a signed manifest (job id, code hash, deadline).
2. **Dispatch.** Units are assigned to volunteers, with **redundant replication** (each unit
   to ≥`r` independent volunteers) for integrity.
3. **Compute locally.** The client runs the **signed** work unit inside a sandbox
   (WASM/container/enclave). No network access beyond the coordinator; no access to other
   units.
4. **Return partials.** Encrypted/authenticated partial results flow back.
5. **Validate.** Compare replicas by **majority/quorum consensus**; spot-check with
   **known-answer canary units**; weight by **reputation**. Reject/re-issue on mismatch.
6. **Reassemble ("re-shard").** A map-reduce style reduce combines validated partials —
   cryptographically recombining secret shares, aggregating gradients, or concatenating
   chunks — on the trusted coordinator, producing the final artifact + an audit manifest.

## 6. Result integrity & anti-abuse

Volunteer nodes are untrusted and possibly adversarial, so correctness can't assume honesty:

- **Replication + quorum.** Every unit computed by multiple independent volunteers; results
  must agree.
- **Canary/known-answer units** seeded randomly to detect cheating or broken clients.
- **Reputation scoring.** Trust accrues with verified correct work; low-trust nodes get
  replicated more heavily and are excluded from sensitive tiers.
- **Signed code + reproducible builds.** Clients only run work units whose code hash matches a
  signed, published build. No arbitrary remote code.
- **Sandboxing.** WASM or container isolation; enclave attestation for Tier C.
- **Rate limits, Sybil resistance, and per-account quotas.**

## 7. Volunteer signup & client

**Signup flow**
1. Create an account (email) and accept the participation terms + data-handling policy.
2. Choose **goals** to support (see §8) and a **resource profile** (CPU/GPU, hours, bandwidth,
   "only when idle/charging").
3. Install a client and link it with a token, or run the browser worker.

**Client options**
- **Native client** (BOINC-compatible) for set-and-forget background compute.
- **Container** (Docker) for homelab/cloud contributors.
- **Browser worker** (WebAssembly + Web Workers + **WebGPU**) for zero-install, opt-in,
  tab-scoped contribution.
- **Enclave client** for Tier C on attestation-capable hardware.

**Good-citizen defaults:** compute only on idle/AC power, throttle to a CPU/GPU budget, hard
caps on bandwidth, and a one-click pause/leave.

## 8. Goals a participant can sign up for

- **Challenge compute** — training/eval for active challenges (e.g., hand-pose estimation).
- **De-identification throughput** — batch-run OSHI-DEID over large public/synthetic corpora.
- **Patient-case solving** — supply the just-in-time compute behind the tiered-intelligence
  escalation loop (see `patient-cases.md`).
- **Benchmark & reproducibility runs** — re-run evaluations across seeds/hardware for
  trustworthy, reproducible leaderboards.
- **General pool** — "use my compute wherever it's needed most."

## 9. Contribution tracking & incentives (optional)

BOINC-style, open and transparent:

- **Credits** for validated work; public **leaderboards** and badges.
- **Project/team affiliations** (labs, universities, communities).
- **Transparency:** every credit traces to validated work units in the audit log.
- Incentives are recognition-first; no scheme should pressure volunteers to weaken privacy
  defaults.

## 10. Architecture & stack

```
 Volunteers ── signed work units ──►  ┌────────────────────────────┐
 (native /                            │  OSHI Grid Coordinator      │
  container /   ◄── validated ──────  │  • job splitter / scheduler │
  browser /        partials           │  • assignment + replication │
  enclave)                            │  • validator (quorum/canary)│
                                      │  • reassembler (reduce)     │
                                      │  • credit / reputation       │
                                      └──────────┬─────────────────┘
                                                 │
                              ┌──────────────────┴───────────────────┐
                              │ trusted data plane (never on grid):   │
                              │ OSHI-DEID · secret-share/HE service ·  │
                              │ object store · Postgres · audit log    │
                              └───────────────────────────────────────┘
```

- **Coordinator/API:** FastAPI (Python) + a job queue (Celery/Redis), or a **BOINC server**
  for the classic path.
- **Privacy services:** Flower/PySyft (federated), MP-SPDZ (MPC), TenSEAL/SEAL/OpenFHE (HE),
  Opacus (DP).
- **Clients:** BOINC (native), Docker (container), WASM + WebGPU (browser), SGX/SEV (enclave).
- **Storage:** object store for work units/artifacts; Postgres for assignments/credits/reputation.
- **Security:** signed manifests, mTLS, reproducible client builds, full audit trail.

## 11. Governance, ethics & safety

- **Consent & transparency.** Volunteers see exactly what tier of data/work they accept; data
  holders consent to any use of their de-identified data in Grid jobs.
- **Privacy review board.** Any job above Tier A requires documented privacy/clinical review
  (re-identification risk, DP budget, method choice) before it can run.
- **No raw PHI, ever, on the grid** — enforced by the §2 invariant and tier gating.
- **Fairness & openness.** Client code, server code, and crypto protocols are open source and
  auditable; results and methods are reproducible.
- **Right to leave.** One-click pause/leave; no lock-in.

## 12. Roadmap

1. **Tier A pilot** — public/synthetic-data work units (e.g., challenge eval) via a browser +
   container client. Proves split → dispatch → validate → reassemble with replication.
2. **Credits & leaderboards** — transparent contribution tracking.
3. **Federated (Tier B)** — Flower-based federated training with secure aggregation + DP.
4. **MPC/HE/TEE (Tier C)** — secret-sharing and enclave paths, gated by the privacy review board.
5. **Integration** — wire Grid compute into the challenge eval pipeline and the patient-case
   escalation loop.

## 13. How to contribute

Open design — feedback and PRs welcome on the
[OSHI Arena GitHub org](https://github.com/oshi-arena). High-value early work: the Tier A
work-unit protocol + browser/WASM client, the validation/reputation service, and a Flower
proof-of-concept for Tier B.

*This is a living document and will evolve with the project.*
