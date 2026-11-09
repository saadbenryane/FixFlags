---
status: supporting
authority: operations
reviewed_at: 2026-11-05
---

# Runtime and AI cost optimization

The November 5 research below supports the implementation sequence in [the product masterplan](product-masterplan.md#ai-efficiency-and-provider-independence-plan-2026-11-05). It does not establish model quality, measured production savings or permission to purchase inference capacity. The existing runtime and maintenance observations remain historical evidence at their stated dates.

## Operator commands

`npm run sites:purge -- --preview --manifest <private-file> --email <owner> --keep-host <retained-host> --remove-host <host> --unlinked-host <host>` creates a database-bound manifest. Repeat host arguments to enumerate the exact scope. `--apply --manifest <private-file>` revalidates ownership and inventory, fences execution, erases captures, and deletes one report per transaction. It resumes from `<private-file>.progress.json`. The command never loads a local environment file. Supply the intended `DATABASE_URL` explicitly.

Keep both private files outside version control. They contain identifiers, not report content, and are needed to reapply erasure after an older backup is restored. Preserve the retained site's reports and all other tenants. Existing backup retention remains separate from deletion in the active database.

Before applying, measure free storage in the actual database container, inspect WAL usage and `max_wal_size`, and reserve room for deletion and checkpoints. Root-report cascades can write substantial WAL even in small report batches. Checkpoint mode defaults to every five reports and refuses a WAL budget above 256 MB. Setting `--checkpoint-every 0` is an explicit operator override, not the production default. A completed checkpoint may need subsequent cycles to retire previously preallocated WAL segments. Never delete WAL files directly.

`npm run validation:session -- --service Validation-Web -- <verification-command>` starts only the requested public-validation services and their referenced validation dependencies, waits for startup, runs the command, and stops the services in reverse order on success, failure, or ordinary interruption. It refuses production dependencies and services already owned by another session. This wrapper does not authorize browser tests; those still require an explicit request. Verify cleanup after an abrupt host or process failure.

## Runtime budgets

The worker's PageSpeed cache is bounded by 500 entries and 16 MiB of serialized values, rejects oversized entries, and expires unread entries. `npm run cost:profile-cache` compares the committed predecessor with the current cache using synthetic payloads and post-GC heap measurements. Serialized bytes, JavaScript heap, process RSS, and container memory are separate measurements.

Prisma pools use at most five web connections or ten worker connections, retaining a smaller explicit limit. The default pool timeout is ten seconds. Credentials and private hostnames are preserved. Worker memory logs contain fixed numeric fields, active-task counts and browser-context counts, without website content or credentials.

## Deployment and rollback

The cost runtime branch is based on the deployed `aa90044dbb306b09ae28309950db45738a9bdcff`, preserving unrelated checkout changes. Deploy that isolated candidate, not the dirty primary worktree. Keep the deployed image digest and source commit with the operator receipt. Pool and cache changes can be rolled back to the preceding deployment; erasure cannot.

The November 2 cleanup interrupted once when WAL exhausted the 5 GB database volume. PostgreSQL recovered automatically. WAL was changed from 1024/80 MB maximum/minimum to 128/32 MB, then the purge resumed with checkpoints. Ordinary vacuum/analyze completed. Approximately 510 MiB was free afterward. Existing release backups on that volume were preserved. Do not treat reusable database space as an immediate reduction in provisioned volume size.

Public-validation services have no Git deployment triggers and are parked between validation sessions. Their volumes and deployment definitions are retained. Extra Redis services remain stopped because absence of production references alone does not prove their queues can be discarded.

The previous billing period used $80.41, including $69.01 of RAM. Validation shutdown is estimated to save about $10/month. Madouane had five replicas with two analysis slots each. Consolidating to two replicas with five slots retains ten total slots and is estimated to save about $12/month of idle RAM. These are estimates until provider usage settles.

Observe normal activity for 72 hours. Compare equivalent retained-site checks, memory after completed work, errors, pool waits, and queue latency. Revert runtime or pool changes if comparable execution time or queue latency worsens by more than 10 percent. When traffic is insufficient, record the evidence gap instead of declaring performance acceptance. Keep the $80 soft usage alert and no hard shutdown limit.

## AI efficiency research, November 5, 2026

### Recommendation and evidence limits

Make routine monitoring operate on fresh executable evidence. Use deterministic repair definitions wherever they fully describe the recorded problem. Evaluate a small decision model for narrow semantic judgments, reuse compatible derived interpretations, and generate new prose only when it contributes a specific useful instruction. Retain a stronger model for demonstrated difficult cases. Hosting choice comes after task quality, volume and total-cost measurements.

These recommendations follow current source inspection and the official sources linked below. No paid model comparison, GPU deployment, fine-tuning, production spend query or provider invoice reconciliation was performed for this research. The production model variables were inspected without exposing secrets; both services use the code defaults. The preceding credits-related HTTP 429 remains an availability observation, not a measured explanation of the entire bill. Railway RAM, database/storage and browser costs remain separate from OpenAI spend. FixFlags customer credits and entitlements are also separate from provider token charges.

### Implementation follow-up

The table below retains the research checkpoint, not a current implementation claim. The subsequent source correction is recorded in [the completion implementation](product-masterplan-history-2026-11-09.md#completion-implementation-november-5). Request-bound dollar admission, chat and operator custody, mixed-lifetime pricing and exact page-triage reuse are now implemented locally. Gateway prices require their own explicit four-category contract. Triage and journey defaults now use `gpt-4o-mini-2024-07-18` and `claude-haiku-4-5-20251001`, the published snapshots behind their former aliases. This does not select a new model family or establish quality, funding or savings. [OpenAI snapshots](https://developers.openai.com/api/docs/models/gpt-4o-mini) and [Claude versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions) establish the identity distinction. New receipts capture configured rates; earlier stored estimates remain unchanged. The current verified Sonnet 5 Standard input/output rates are $2/$10 per million tokens. [Anthropic pricing](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).

### What exists today

| Source owner | Observed implementation | Consequence for the plan |
| --- | --- | --- |
| `lib/audit/judge-config.ts` | Triage defaults to `gpt-4o-mini`, with 1,500 maximum output tokens. Journey planning and evaluation use this configuration too. | Separate task contracts and measured output requirements before changing models. A maximum is not actual consumption. |
| `lib/audit/judge-config.ts`, `judge-prescription.ts`, `prescription-plan.ts` | Repair generation defaults to `gpt-6-luna`; the default output ceiling is 8,192 tokens. Batches preserve up to 12 unique Flag keys, and larger reviews repeat context and supplied screenshots across batches. | Measure repeated input and useful output per batch. Count-based batches are not token budgets. Preserve every original occurrence and the existing batch identity. |
| `lib/audit/run-ai-review.ts` | Prescription requires primary metadata, a recorded verdict and score, and a desktop capture before preparing selected Flag guidance. | Nonvisual repairs should depend on their own source evidence rather than unrelated visual or scoring prerequisites. Refactor dependencies without inventing missing facts. |
| `lib/improvements/repair-guidance.ts`, `lib/audit/check-registry.ts` | Recorded guidance and registered check recipes already resolve through one repair definition. | Extend this owner. Do not introduce another template registry or different repair truth for email, API, MCP and UI. |
| `lib/audit/provider-usage.ts`, `provider-request.ts`, `prescription-usage.ts` | Durable provider attempt/response custody exists, including unknown consumption after interruption. Initial-analysis phases and prescription costs retain separate ownership. | Extend measurement and atomic admission here. Do not create a second job or billing ledger. Inventory chat and health consumers too. |
| `lib/billing/costs.ts` | Model rates and cache multipliers exist; unknown mixed-model consumption stays unknown. | Add API/tier/version-aware normalization. Token counts from different providers and endpoints are not interchangeable. |
| `lib/audit/cache.ts` | PageSpeed cache is bounded by 500 entries and 16 MiB, with expiry. | Keep it. It is not an exact semantic-result cache and does not solve repeated AI interpretation. |
| `lib/workspace/chat.ts` | Chat is a separate provider consumer, with its own model, history and 600-token default response ceiling. | Include chat in spend inventory without coupling conversational budgets to monitoring correctness. |
| `lib/audit/health/ai-providers.ts`, health route | Public health is configuration-only; live validation requires current administrator authority and trusted origin. The probe currently selects a fixed model. | Keep probes protected. Align a future bounded probe with the actual configured contract rather than a retired model. |
| `lib/audit/jev-client.ts`, `jev-triage.ts`, `scripts/jev-validate.ts` | Jev is research-only. The inactive adapter ignores images and deadlines/known observations, trusts JSON by cast, rounds raw rubric positions as if they were 0 to 100, and can infer visual assessment from a hint. The harness separately normalizes scores. | Do not activate this adapter. Replace its incompatible translation with validated task-specific decisions and migrate the harness to that shared contract. |

The old Jev harness also assumes $0.42 per million input tokens. That is historical pricing, ten times the current listed $0.042. Its simulated replies establish wiring only. No stored old comparison should be relabeled with a new model, price or accuracy result.

### What should use inference

| Responsibility | Intended execution | Evidence and authority |
| --- | --- | --- |
| Uptime, HTTP failures, incident confirmation, notification eligibility | Deterministic collection and policy | Fresh requests, existing cadence, incident continuity and recipient authority. Zero generative calls. |
| Links, headers, canonical declarations, robots, structured markup, tag detection | Deterministic parsers and executable checks | Actual declared/fetched facts and current detector semantics. A classifier cannot suppress these checks. |
| Accessibility rules, focus behavior, mobile navigation, overlays, motion, loading and action timing | Native browser observation and registered rules | Keep device, action, access and temporal conditions. A screenshot or model opinion cannot replace execution. |
| Verification and recurrence for those checks | Fresh comparable observations and existing source membership | Neither a cached opinion nor an AI claim can resolve an incident. |
| Page purpose or a precisely defined copy judgment | Deterministic features first, then a validated decision model where needed | A bounded label or probability with explicit unknown/unsupported scope. Classification must not redefine mandatory applicability. |
| Visual prominence or hierarchy judgment | Visual evidence plus a validated multimodal evaluator | Actual supplied image, device and source references. A text-only execution cannot establish visual quality. |
| Common repair instructions | Existing versioned repair recipes with source-bound arguments | Specific target, prerequisites and original acceptance. Do not send HTTP-header repairs to a vision model. |
| Unusual repair explanation or complex contextual guidance | One bounded generative task with selected evidence | Useful instructions must pass the existing guidance and scope contract. Generation does not imply execution or recovery. |
| Account signup, verification, sign-in and deletion | Authorized executable lifecycle | Models may select only admitted safe actions. They cannot grant authority or declare business success. |
| Customer chat | Retrieved current facts plus a bounded conversational model | No hidden privileged actions, fabricated healthy states or customer decision about which model to use. |

### Provider and self-hosted candidates

These are task candidates, not interchangeable replacements for the complete product. Price is USD per million input tokens, checked November 5. Media, cache writes, regions, service tiers and hosting overhead can change the actual cost.

| Candidate | Role worth evaluating | Current facts | Important limitation |
| --- | --- | --- | --- |
| TypeSafe Jev 1.14 | Narrow text decisions | Current version `jev-1.14.0`; $0.042 input, no output charge. Hosted API with text as the baseline. | No public self-hosted Jev weights were identified. It cannot generate repair prose. Image support is explicitly experimental and not production-ready; our adapter sends no images. |
| Cloudflare Clef Flash | Hosted or self-hosted multimodal decisions | 9B, $0.038 hosted input, no output-token charge; Apache-2.0 release with decision head. | Context and media limits apply. The hosted API documents truncation of long state; FixFlags must detect/refuse incomplete required input itself. |
| Cloudflare Clef | More capable multimodal decision candidate | 27B, $0.24 hosted input, no output-token charge. | Larger serving footprint. Compare quality before paying for a larger model. |
| Kev 0.8B / 4B | Self-hosted text decisions and local evaluation | Apache-2.0 family, Jev-like interface; CUDA and Apple Silicon paths. Start the substantive comparison with 4B, with 0.8B as a constrained baseline. | Quality and confidence change with domain, context, quantization and option order. It does not replace a prose generator or visual collector. |
| Kev 9B / 27B | Quality escalation within a self-hosted decision family | Released checkpoints and versioned model cards exist. | Additional hardware and maintenance must beat the measured alternative, not just an API sticker price. |
| OpenAI Decisions with GPT-6 Luna | Existing-provider typed-decision comparison | $0.10 uncached input, no output-token charge on `/v1/decisions`; images and typed answers. | Still depends on the same funded provider. Its request, response and usage schema differs from Jev and Chat Completions. |
| GPT-6 Luna generation | Current small hosted prose baseline | Standard input $0.10, output $0.50, cached input $0.01 and cache writes $0.125. | Generation remains necessary only for prose tasks. Cache writes and long-context multipliers must be measured. |
| Qwen3.5 4B / 9B instruct models | Self-hosted generation comparison | Official Apache-2.0 multimodal releases. | Structured JSON syntax is not factual or repair correctness. Test the actual pinned model/engine combination. |
| SetFit or a calibrated classical classifier | CPU inference for stable, well-labeled text tasks | Prompt-free supervised classification can be served without generative output. | Needs representative labels, drift checks and an abstention policy. It cannot synthesize fixes or prove native behavior. |

Sources: [TypeSafe models](https://docs.typesafe.ai/models), [Clef Flash API](https://developers.cloudflare.com/workers-ai/models/clef-flash/), [Clef API](https://developers.cloudflare.com/workers-ai/models/clef/), [Kev project](https://github.com/jaredpalmer/kev), [Kev 4B model card](https://huggingface.co/jaredpalmer/kev-4b), [OpenAI Decisions](https://developers.openai.com/api/docs/guides/decisions), [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Qwen 4B](https://huggingface.co/Qwen/Qwen3.5-4B), [Qwen 9B](https://huggingface.co/Qwen/Qwen3.5-9B), [SetFit](https://huggingface.co/docs/setfit/index).

TypeSafe's primitives return choices, probabilities and rubric positions, not generated explanations. Raw Score is a fractional position in the supplied ordered levels; it is not already a percentage. Preserve the distribution and scale identity. Convert to a display score only through the existing policy when that conversion is actually justified. Vendor confidence is an input to calibration, not a passing observation. [TypeSafe primitives](https://docs.typesafe.ai/introduction), [Score semantics](https://docs.typesafe.ai/primitives/score), [probability calibration](https://scikit-learn.org/stable/modules/calibration.html).

The model overview lists text input, while the newer image guide documents an opt-in image/Box path and explicitly describes it as not ready for production. This updates the older text-only understanding without establishing safe visual operation. Keep the experimental path out of production selection until a pinned implementation and FixFlags visual evaluation justify it. [TypeSafe image support and current limitations](https://docs.typesafe.ai/images).

The official GPT-4o Mini model page now marks it deprecated. The deployment's triage, planner, evaluator and chat defaults therefore need a tested migration. No retirement date or account-specific availability was established here, and this does not explain away the observed credits error. [GPT-4o Mini model status and rates](https://developers.openai.com/api/docs/models/gpt-4o-mini).

### Serving and total cost

Use the exact released decision implementation. Clef Flash publishes a backbone plus a separate joint schema head and a `systemone` path. Generic model-hosting snippets are not proof that the specialized head, schema encoding, probabilities and calibration are being served. Kev has its own serving and calibration requirements. Pin all weights, adapters, tokenizers, heads, temperatures and execution libraries; compare the same precision and context used in deployment. [Clef Flash release and serving instructions](https://huggingface.co/Cloudflare/clef-flash), [Kev release and serving instructions](https://github.com/jaredpalmer/kev).

For ordinary generative models, evaluate one engine first: vLLM for a supported GPU workload, or llama.cpp for an appropriate quantized CPU/Metal workload. MLX is useful for local Apple Silicon experiments. SGLang is a valid alternative when the actual model/workload shows a benefit; do not add multiple serving stacks without a reason. Keep a customer production inference service independent of the developer laptop and of the current browser/queue worker's resource budget. [vLLM structured outputs](https://docs.vllm.ai/en/latest/features/structured_outputs/), [llama.cpp](https://github.com/ggml-org/llama.cpp), [MLX LM](https://github.com/ml-explore/mlx-lm), [SGLang structured outputs](https://docs.sglang.io/docs/advanced_features/structured_outputs).

Prefix/KV caching saves repeated prefill work; it does not reuse a final answer or eliminate output decoding. Application-level reuse of a compatible interpretation is a different optimization. Quantization can alter probabilities, ranking and repair quality, so it needs the same held-out checks as a different model. Nominal weight bytes alone cannot determine fit: activation/workspace, KV state, vision, concurrency and fragmentation also consume memory. [vLLM prefix caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/).

An illustrative 2,000-input-token decision request costs $0.000084 on the listed Jev rate, $0.000076 on hosted Clef Flash, $0.00048 on Clef, or $0.0002 at OpenAI Decisions' uncached rate. These are rate calculations for comparable text-input quantity, not equivalent task quality, a complete scan price or actual billed requests. OpenAI cache writes and other modifiers are excluded. Ten narrow questions in one request do not imply ten separately billed requests; measure each provider's reported billable input including its question encoding.

For comparison, Modal currently lists L4 at $0.000222/second, L40S at $0.000542/second, plus CPU and memory. L4 alone is approximately $0.7992/hour or $583.42 at 730 allocated hours. Matching that GPU-only monthly cost against the simple Clef Flash example takes roughly 7.68 million requests. This is a break-even illustration, not a claim that an L4 can serve a particular model or that a self-hosted service is always on. Batching, utilization, cold starts, warm retention, actual model quality, support time, availability and data locality determine the real choice. Scale-to-zero can reduce idle cost but adds cold-start and model-loading costs. Existing owned hardware still has power, maintenance, backup and availability costs. [Modal resource pricing](https://modal.com/pricing).

Use `self_hosted_monthly_cost / avoided_hosted_cost_per_accepted_task` only after subtracting any remaining hosted escalation cost. Compare cost per accepted useful result, not cost per request or parameter count. Measure cold and warm p50/p95, successful/abstained output rate, billable GPU seconds, queue wait, context and image size, throughput under realistic bursts, and peak resident/accelerator memory. No self-hosted production service or paid capacity was started for this research.

### Token and caching economics

For each call, normalize mutually exclusive uncached input, cache-read input, cache-write input and output categories, then multiply by the endpoint/model/version/tier rates. Keep reported reasoning usage separate where available without counting it twice if already included in output. Retain null/unknown consumption for lost or invalid reports. Never estimate a multi-model bill from one aggregated model name and token total.

OpenAI's current newer-model cache writes can cost more than uncached input, and retention choice changes that premium. The current Chat Completions usage reader subtracts cached reads but does not model all newer cache-write categories. Extending caching without fixing measurement first could hide spend. Put stable instructions and schemas before changing evidence, preserve tenant boundaries, and select retention from observed reuse rather than always choosing the longest duration. Provider caching does not prove a previous semantic judgment is valid for new evidence. [OpenAI prompt caching and pricing rules](https://developers.openai.com/api/docs/guides/prompt-caching).

Batch API offers a 50% discount with a turnaround window of up to 24 hours. It suits offline evaluation and explicitly delay-tolerant enrichment, not outages, required initial results, active repair verification or normal monitoring cadence. Flex can return unavailable capacity and has different latency. Use it only for suitable work with bounded ownership and a declared escalation cost. Do not turn a short native task lease into a 24-hour worker occupation. [Batch API](https://developers.openai.com/api/docs/guides/batch), [Flex processing](https://developers.openai.com/api/docs/guides/flex-processing).

### Evaluation requirements

Build the FixFlags comparison from its own current evidence, not results from another product or vendor leaderboards. Include text, native visual evidence, English and representative non-English sites, mobile and desktop, hidden versus visible controls, dynamic/unchanged pages, missing or restricted input, conflicting cues, real repairs, recurrence, adversarial instructions and both sides of every relevant task boundary.

Use domain-disjoint and time-separated development, calibration and sealed test sets. Keep duplicate pages, shared templates and variants from the same Site in one split. Start with a manageable labeled panel and expand boundary strata until uncertainty is useful; a small panel cannot establish rare-error safety. Record truth and rationale from the actual evidence. A teacher model can propose labels, but agreement with that teacher is not ground truth.

Compare deterministic/current-recipe-only execution, current hosted behavior when funds and a capped evaluation are available, hosted Jev/Clef candidates, self-hosted Kev, and a small generative candidate only for generation tasks. Hold collection, retrieval and prompts fixed for model comparisons; vary compaction, routing and caching in separate ablations. Measure per-task precision/recall, false-healthy and false-recovery claims, unsupported evidence references, exact option/schema conformance, calibrated error/coverage, confidence intervals, latency and total accepted-result cost. Test option permutations and exact deployed quantization. Fit thresholds on calibration data only, separately for each task/language/model revision.

Promote narrow tasks only after they preserve detection and evidence semantics with useful confidence bounds. Models never receive authority to override deterministic failures, grant privileged access, suppress mandatory checks or resolve incidents from probabilities. A structurally valid answer may still be wrong. Preserve explicit unknown observations, and escalate only within the same approved task and budget. The exact implementation sequence and release gates live in the masterplan.
