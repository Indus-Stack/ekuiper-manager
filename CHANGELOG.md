# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Light and dark themes**: A complete light palette, a theme provider with `light`, `dark`, and `system` options (default `dark`), a theme menu in the header, a Theme card in Settings, no-flash theme initialisation, and theme-aware Monaco editors and React Flow canvas. Fixes the theme part of #178.
- **Version-aware Rule Designer & 2.5 preview capabilities**: Added searchable SQL function suggestions in Rule Designer (including eKuiper `2.4.2` additions `array_avg`, `acc_max_by`, `acc_min_by`, `acc_map_agg`), gated preview capabilities to their specific upstream alpha floors (`GET /rules/{name}/scantables` at `2.5.0-alpha.1`, stream `BUFFER_FULL_POLICY` at `2.5.0-alpha.2`, `sourceName` graph decoder safety, `jsonl`, and Kafka record metadata at `2.5.0-alpha.5`), and added a non-blocking Flow Studio `FLOW_SOURCENAME_DECODE_WARNING` diagnostic for `< 2.5.0-alpha.5` targets.
- **Offline Flow Studio authoring & safe deployment**: Kept Flow Studio palette authoring and draft validation enabled using the target's last known capabilities (`resolveAuthoringCapabilities`), while executing an immediate live probe during deployment (`deployFlow`) to reject unreachable engines before attempting creation.

### Changed
- **Bundled eKuiper 2.4.2 & OpenAPI contracts**: Updated the bundled Compose engine to digest-pinned `lfedge/ekuiper:2.4.2-slim` (retaining `2.4.1` support), retargeted the canonical OpenAPI spec (`98` paths / `140` operations) and Swagger API Docs to `v2.4.2`, and added a separate `v2.5.0-alpha.5` preview spec (`99` paths / `141` operations) with CI validation.
- **Responsive Swagger API Docs controls**: Wrapped documentation headers and preview selectors to avoid overflow clipping on 375px mobile viewports.

### Fixed
- **SQL function insertion query safety**: In SQL mode, clicking a function without an active cursor selection now safely inserts the expression into the query `SELECT` list instead of appending it after `FROM demo`. The scanner limits escape handling to string literals (`\'`, `\"`, `''`), preserves backtick identifiers (`...`), and skips single-line (`--`) and multi-line (`/* */`) comments to avoid misidentifying the `SELECT` or `FROM` clauses.
- **Plain-text eKuiper mutation responses**: Updated both eKuiper proxy routes with `sanitizeSensitiveEKuiperBody` so plain-text `"success"` responses on sensitive connection paths succeed cleanly instead of returning HTTP `502`.

## [1.4.0] - 2026-11-04

### Added
- **Flow Studio (Beta)**: End-to-end visual DAG flow editor (`/flows` and `/flows/[id]`) powered by `@xyflow/react`, with 17 built-in source/transform/sink node definitions, declarative extension node support (`@ekuiper-manager/flow-sdk`), Flow-to-eKuiper IR/SQL/JSON compilation, preflight capability and connection-health validation, one-click deploy/undeploy/delete, automatic revision snapshots (`flow_revisions`), semantic diff and rollback-to-revision, 1 Hz runtime operator metrics, command palette (`Ctrl+K`), focus mode, and Monaco expression editing.
- **Bilingual Manager UI (`en-US` & `zh-CN`)**: Full English and Simplified Chinese localization across all Manager pages, Flow Studio, Rule Designer (including built-in and node-provided connector/sink metadata labels and hints), and diagnostic rule-status formatting (`formatRuleStatus`), with persistent locale switching.
- **Interactive Inspector & Connector Pickers**: Searchable comboboxes for option-backed properties, unified connection-registry (`confKey`) pickers for MQTT sources, connector pickers for stream/table reference nodes, and join reference pickers.
- **Static i18n & Placeholder Verification (`npm run check:i18n`)**: AST-based catalog parity, interpolation variable, and empty-JSX expression checks enforced in both Linux and Windows CI jobs.
- **Automated Docker Hub Publishing & Release Pipeline**: Added `.github/workflows/release.yml`, `.github/workflows/docker.yml`, and `deploy/docker/README.md` to automatically publish `indusstack/ekuipermanager` images and sync the Docker Hub README on tag releases.

### Changed
- Replaced legacy third-party API docs bundles with a clean Swagger UI page for the audited eKuiper 2.4.1 OpenAPI reference.
- Consolidated Dependabot configuration and upgraded Next.js (`16.4.2`), React (`19.3.1`), and GitHub Actions dependencies.

### Security
- Added dependency overrides (`source-map-js >=1.2.2`) and resolved all reported `npm audit` and CodeQL advisories.

## [1.3.0] - 2026-08-18

### Added
- Upgraded the page-aware assistant into a permission-aware read-only operations agent with parallel and iterative tool calling across sanitized Manager/PostgreSQL data and allowlisted selected-node eKuiper GET APIs.
- Added a compact per-answer investigation timeline showing which read-only sources completed without exposing tool inputs or raw results.

### Security
- Added fixed parameterized database readers, owner-only user/session/audit/migration access, an explicit eKuiper GET route allowlist, recursive tool-result redaction, and per-call/aggregate/round/deadline budgets.

## [1.2.1] - 2026-08-18

### Added
- Optional context-aware operator assistant on every authenticated page, including the visual rule designer, with safe Markdown replies and clickable related questions.
- Visual/SQL rule designer with generated eKuiper JSON, validation, raw fallback, and safe duplication.
- One-command Manager + official eKuiper 2.4.1 + private PostgreSQL deployment.
- Bootstrap owner, local owner/user lifecycle, secure sessions, password reset/change, and audit events.
- Server-owned multi-node registry with encrypted authorization values, probe/select/default flows, and safe proxying.
- Audited eKuiper 2.4.1 OpenAPI contract with 98 paths and 140 management operations.

### Changed
- Replaced experimental browser/SQLite persistence and caller-selected targets with checked PostgreSQL migrations and registered-node routing.
- Corrected rules, streams, tables, schemas, connections, plugins, functions, services, uploads, metadata, and import/export flows to the eKuiper 2.4.1 contract.
- Simplified navigation and resource workspaces around node-scoped operator journeys and progressive resource forms.
- Pinned production images and moved PostgreSQL behind the private Compose network.

### Security
- Provider credentials for the optional assistant remain server-side; page context is bounded, redacted twice, and sent only on an explicit message.
- Added same-origin mutation checks, rate limits, encrypted node secrets, recursive response redaction, DNS/IP target validation, redirect rejection, non-root containers, a read-only Manager filesystem, and dropped capabilities.
- Removed legacy debug, EMQX, Supabase, arbitrary AI, and client-selected proxy routes from the supported stack.

### Fixed
- Preserved eKuiper JSON, text, binary, multipart, PATCH, query, status, and content-header behavior through the Manager proxy.
- Corrected stale plugin/service/function/schema/upload/import-export request and response assumptions.

## [1.2.0] - 2026-01-26

### Added
- **AI Assistant**: New conversational agent for generating rules and streams.
- **Query Designer (Beta)**: Initial scaffolding for a visual rule builder (Shop Floor Edition).
- **Swagger API Playground**: Interactive documentation for eKuiper APIs.
- **Rule Tracing**: Visual debugging for rule execution paths.

### Changed
- **Persistence**: Switched default persistence to Browser Local Storage for easier onboarding.
- **UI**: Improved connection status indicators and dialogs.

### Fixed
- Fixed memory leaks in development environment during compilation.
- Fixed production build by forcing Webpack over Turbopack for custom configurations.
- Fixed security vulnerability (js/resource-exhaustion) in MQTT debug API by capping timeouts.
- Improved EMQX connection stability.
