# eKuiper Engine Compatibility Guide

![Manager Engine Version Matrix and Capability Gates](./diagrams/engine-version-matrix.svg)

This document defines the supported eKuiper versions, API contracts, and UI capability gates in eKuiper Manager.
The text follows the ASD-STE100 simplified English standard.

---

## 1. Supported Engine Versions

Manager supports multiple eKuiper versions through one semver boundary in `src/lib/flows/capabilities/resolve-capabilities.ts`.

| Engine Version | Role | Image / Tag | OpenAPI Contract |
| --- | --- | --- | --- |
| `2.4.1` | Supported minimum baseline | `lfedge/ekuiper:2.4.1` | `public/ekuiper-openapi.json` (98 paths, 140 operations) |
| `2.4.2-slim` | Bundled Compose default | `lfedge/ekuiper:2.4.2-slim` (`sha256:0e43ef0bfa59d112d0df56b94df817adba44f0906129a5a1a7458eaece975d8a`) | `public/ekuiper-openapi.json` (98 paths, 140 operations) |
| `2.5.0-alpha.5` | Separate preview contract | `v2.5.0-alpha.5` | `public/ekuiper-openapi-2.5-preview.json` (99 paths, 141 operations) |

Procedure to detect target capabilities:

1. Manager queries `GET /` when it probes a registered node (`POST /api/nodes/{id}/probe`).
2. `probeNode` stores the reported engine version in PostgreSQL and rejects versions below `2.4.1`.
3. UI and compiler layers call `resolveTargetFeatures(version)` to obtain boolean `TargetFeatureFlags`.
4. Components show or hide version-specific controls without separate version parsers.

---

## 2. OpenAPI Contracts and Swagger Switcher

Manager keeps the GA and preview REST specifications in separate files:

- Canonical GA contract: `public/ekuiper-openapi.json` and `docs-site/ekuiper-openapi.json` (`2.4.2`, identical bytes).
- Preview contract: `public/ekuiper-openapi-2.5-preview.json` (`2.5.0-alpha.5`, adds `GET /rules/{name}/scantables`).

Run the local OpenAPI validators before commits:

```bash
cmp public/ekuiper-openapi.json docs-site/ekuiper-openapi.json
npm run validate:openapi -- --skip-official
npm run validate:openapi -- public/ekuiper-openapi-2.5-preview.json --skip-official
```

When network access to GitHub is available, remove `--skip-official` to compare routes against upstream tags (`v2.4.2` and `v2.5.0-alpha.5`).
Operators can switch between **2.4.2 (GA)** and **2.5.0-alpha.5 (Preview)** inside `/api-docs`.

---

## 3. Named SQL Connection Recovery (`2.4.2`)

Upstream PR `#4128` in eKuiper `2.4.2` fixes automatic recovery for named SQL connections when startup connection initialization fails.

1. Use `/connections` or `POST /api/ekuiper/connections` to create named shared connections (`typ: "sql"`).
2. Read `/connections` to inspect live `status` (`connected` or `failed`) and error messages.
3. Click **Refresh** on `/connections` to confirm status transitions after engine recovery.

Note on container plugins:

- The bundled `lfedge/ekuiper:2.4.2-slim` image and `2.4.1` core image support `/connections` API registration, but they do not include the `sql` runtime sink/source plugin binary.
- Use a full or custom plugin image when rules must execute live SQL database queries or writes.

---

## 4. Flow Studio Saved-Stream Graph Path (`PR #4213`)

![Flow Studio Saved-Stream Graph Path and PR #4213 Behavior](./diagrams/sourcename-graph-flow.svg)

When Flow Studio compiles a `stream-source` or `table-source` node, it emits `sourceType` and `sourceName` in graph node properties (`src/lib/flows/compiler/ekuiper/compile-graph.ts`).

Live behavior on `2.4.1` and `2.4.2` (where upstream PR `#4213` is absent):

- **Memory saved streams** (typed and schemaless) pass decoded event fields to downstream operators.
- **Byte-decoded saved streams** (for example `file` saved streams) omit stream decoder configuration and emit empty `{}` objects.
- **Warning diagnostic**: Client validation, Node Inspector, server validation, and the Deploy preflight dialog show a non-blocking `FLOW_SOURCENAME_DECODE_WARNING` on targets below `2.5.0`.
- **Target `2.5.0+`**: The warning clears because PR `#4213` preserves decoder properties on `sourceName` graph nodes.

Operator recommendation for `2.4.1` and `2.4.2` nodes:

- Use SQL rules in Rule Designer or explicit `memory-source` / `mqtt-source` nodes when a flow reads byte-encoded data.

---

## 5. Rule Designer and Workspace Feature Gates

### 5.1 Version `2.4.2+` SQL Functions (`supportsSqlFunctions242`)

Rule Designer (`/rules/new` and `/rules/{id}/edit`) filters the SQL function helper catalog with `getFunctionsForVersion(active?.version, query)`:

- `array_avg(arr)`
- `acc_max_by(value, compare_value)`
- `acc_min_by(value, compare_value)`
- `acc_map_agg(key, value)`

These four functions stay hidden when the active node runs `2.4.1`.
Rule Designer deduplicates `changed_cols` across categories in its UI function list.

### 5.2 Post-`2.4.2` Named Sink Actions (`PR #4235`)

Upstream PR `#4235` on `master-2.4` introduces optional names on sink actions so rules can distinguish two actions of the same connector type.

Caution when named actions are enabled on future `2.4.x` / `2.5+` engines:

- Renaming a sink action changes the engine metric keys and persistent-state identifiers for that sink.
- Always inspect topology and metrics after changing a sink name.

### 5.3 Preview `2.5.0+` Features

Manager exposes these controls only when the selected node reports version `2.5.0` or higher:

- **Scan tables tab** (`supportsScanTables`): Rule detail page (`/rules/{id}`) displays the **Scan tables** tab calling `GET /rules/{name}/scantables`. Non-join tuple errors normalize to an empty state.
- **JSON Lines (`jsonl`) format** (`supportsJsonl`): Shown in Stream Visual Editor (`/streams/new`) and `SinkBaseForm`. Existing saved `jsonl` configurations stay visible even on unknown node versions.
- **Stream `BUFFER_FULL_POLICY`** (`supportsStreamBufferPolicy`): Shown in Stream Visual Editor (`block` or `dropOldest`).
- **Kafka record metadata** (`supportsKafkaRecordMetadata`): Enables `meta_topic`, `meta_partition`, `meta_offset`, `meta_key`, and `meta_headers` in Rule Designer.

---

## 6. Pre-Upgrade Verification Checklist for Defaulting `2.5`

Do not change `compose.yaml` to bundle an eKuiper `2.5` image until all three checks pass in live Compose testing:

1. **Listener and RPC access (`#4244`)**: Test Manager-to-engine REST requests across the Compose network under new loopback bind defaults and `basic.disableRpc` settings.
2. **External file access sandbox (`#4144`)**: Test file upload, playback, and SQL/sink file paths under the new `allowExternalFileAccess` default (`false`).
3. **Checkpoint upgrade and rollback (`#4195`)**: Test checkpoint persistence and pre-upgrade backup restore, because `2.5` introduces versioned checkpoints that older `2.4.x` binaries cannot downgrade cleanly.

