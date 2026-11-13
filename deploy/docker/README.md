# indusstack/ekuipermanager

[![Docker Pulls](https://img.shields.io/docker/pulls/indusstack/ekuipermanager?color=blue&logo=docker)](https://hub.docker.com/r/indusstack/ekuipermanager)
[![Release](https://img.shields.io/badge/release-v1.4.0-blue.svg)](https://github.com/Indus-Stack/ekuiper-manager/releases)
[![CI](https://github.com/Indus-Stack/ekuiper-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/Indus-Stack/ekuiper-manager/actions/workflows/ci.yml)
[![License: IOSL](https://img.shields.io/badge/License-IDACS%20Open%20Source-green.svg)](https://github.com/Indus-Stack/ekuiper-manager/blob/main/LICENSE)

`ekuiper-manager` is a self-hosted web interface and operations manager for **LF Edge eKuiper** and **reKuiper**. It provides a visual DAG Flow Studio, a SQL and visual Rule Designer, an audited eKuiper v2.4.1 OpenAPI playground, multi-node management, and an optional read-only operations assistant in one container image.

---

## Quick Start

### 1. Run the Complete Stack with Docker Compose (Recommended)

Clone the repository and start `ekuiper-manager`, official `eKuiper 2.4.1`, and a private `PostgreSQL 17` sidecar:

```bash
git clone https://github.com/Indus-Stack/ekuiper-manager.git
cd ekuiper-manager
docker compose up -d
```

Open `http://localhost:3000` in your browser, create the first owner account, and sign in.

Verify readiness:

```bash
curl --fail http://localhost:3000/health/ready
```

---

### 2. Run the Standalone Container

Run `indusstack/ekuipermanager` against an existing PostgreSQL 17 database and an existing eKuiper or reKuiper node:

```bash
docker run -d --name ekuiper-manager \
  -p 3000:3000 \
  -e PGHOST=host.docker.internal \
  -e PGPORT=5432 \
  -e PGDATABASE=ekuiper_manager \
  -e PGUSER=ekuiper_manager \
  -e PGPASSWORD=replace-with-db-password \
  -e DEFAULT_EKUIPER_URL=http://host.docker.internal:9081 \
  -e MANAGER_ORIGIN=http://localhost:3000 \
  -v ekuiper_manager_state:/var/lib/ekuiper-manager \
  indusstack/ekuipermanager:1.4.0
```

At startup, the container entrypoint (`/usr/local/bin/ekuiper-manager-entrypoint`) acquires a migration lock, runs committed SQL migrations from `/app/database/migrations`, and starts the Next.js standalone server on port `3000`.

---

## Key Features

### 1. Flow Studio (Visual DAG Editor)
Build, validate, and deploy streaming pipelines visually:
- **17 Built-In Node Definitions**: MQTT, Memory, REST/HTTP, Log, and Stream/Table reference nodes, plus Filter, Pick, Function/Script, Window, Aggregate, Group By, Switch, Sort, and Join transforms.
- **Preflight Validation & Deployment**: Compiles visual flows to eKuiper SQL/JSON and validates capability and connection health before deployment.
- **Revision History & Semantic Diff**: Automatically snapshots each deployment (`flow_revisions`), compares revisions visually, and supports rollback to draft.
- **Live 1 Hz Runtime Metrics**: Polls eKuiper operator metrics and maps throughput and error counts directly onto canvas nodes.

### 2. Bilingual UI (`en-US` & `zh-CN`)
Switch between **English (`en-US`)** and **Simplified Chinese (`zh-CN`)** at runtime:
- Covers all Manager workspaces, Flow Studio controls, command palette actions, and Rule Designer forms.
- Localizes built-in and node-provided connector and sink metadata labels and hints while preserving diagnostic suffixes.

### 3. Multi-Node Registry & Security Boundary
Manage multiple eKuiper and reKuiper instances safely:
- Encrypts node `Authorization` headers at rest using AES-256-GCM (`/var/lib/ekuiper-manager`).
- Never exposes stored credentials to the browser; recursively redacts secret fields in responses.
- Enforces same-origin checks on mutations and DNS/IP SSRF validation on every proxied node request.

### 4. Read-Only Operations Agent (Optional)
Enable an OpenAI-compatible tool-calling assistant to correlate Manager state with live eKuiper node diagnostics under strict read-only and secret-redaction budgets.

---

## Exposed Network Ports

| Port | Protocol | Purpose | Default Bind |
| :--- | :--- | :--- | :--- |
| **`3000`** | HTTP / TCP | **Web UI, REST API & Health Probes** (`/health/live`, `/health/ready`). | `0.0.0.0:3000` |

---

## Configuration & Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP listener port inside the container. |
| `MANAGER_ORIGIN` | `http://localhost:3000` | Browser-visible origin required for same-origin mutation validation. |
| `DATABASE_URL` | (Empty) | Full PostgreSQL connection URI (overrides `PG*` variables when set). |
| `PGHOST` | `database` | PostgreSQL server hostname. |
| `PGPORT` | `5432` | PostgreSQL server port. |
| `PGDATABASE` | `ekuiper_manager` | PostgreSQL database name. |
| `PGUSER` | `ekuiper_manager` | PostgreSQL username. |
| `PGPASSWORD` | (Required) | PostgreSQL password. |
| `DEFAULT_EKUIPER_URL` | `http://ekuiper:9081` | Default eKuiper or reKuiper endpoint registered on first startup. |
| `SESSION_TTL_HOURS` | `12` | Authenticated browser session lifetime in hours. |
| `EKUIPER_API_TIMEOUT` | `30000` | Upstream node proxy request timeout in milliseconds. |
| `AI_ASSISTANT_ENABLED` | `false` | Enables the optional read-only operations agent (`true` or `false`). |
| `AI_API_URL` | (Empty) | OpenAI-compatible Chat Completions base URL. |
| `AI_API_KEY` | (Empty) | Server-side API key for the AI provider. |
| `AI_MODEL` | (Empty) | Model identifier for the operations agent. |

---

## Persistent Storage & Volumes

| Container Path | Purpose |
| :--- | :--- |
| `/var/lib/ekuiper-manager` | Stores the installation AES-256-GCM master key used to encrypt node credentials in PostgreSQL. Back up this volume alongside your PostgreSQL database dump. |

---

## Container Hardening

The image is designed to run with strict container security flags:
- Non-root user (`uid=1001`, `gid=1001`, `ekuiper-manager`)
- Read-only root filesystem (`--read-only` with `--tmpfs /tmp`)
- All Linux capabilities dropped (`--cap-drop ALL`)
- `no-new-privileges: true`

---

## Links

- **GitHub Repository**: [https://github.com/Indus-Stack/ekuiper-manager](https://github.com/Indus-Stack/ekuiper-manager)
- **Releases & Changelog**: [https://github.com/Indus-Stack/ekuiper-manager/releases](https://github.com/Indus-Stack/ekuiper-manager/releases)
- **reKuiper Engine (Rust)**: [https://hub.docker.com/r/indusstack/rekuiper](https://hub.docker.com/r/indusstack/rekuiper)
- **Issue Tracker**: [https://github.com/Indus-Stack/ekuiper-manager/issues](https://github.com/Indus-Stack/ekuiper-manager/issues)

