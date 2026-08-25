# GoldenKey Data Platform

This directory contains the local, free data-engineering environment for the
GoldenKey admissions system. It is separate from the React and Express runtime.

## Prerequisites

- Python 3.12
- Docker Engine or Docker Desktop with Compose v2

Docker is not currently available in the development environment used to create
this foundation. Structural tests pass, but the runtime commands below still need
to be executed on a Docker-enabled machine.

## Start the foundation

```powershell
Set-Location data-platform
Copy-Item .env.example .env
docker compose config --quiet
docker compose up -d --wait
docker compose ps
```

Local endpoints:

| Service | Host endpoint | Purpose |
|---|---|---|
| Source PostgreSQL | `127.0.0.1:55432` | Safe local operational source |
| Warehouse PostgreSQL | `127.0.0.1:55433` | Analytical destination |
| SeaweedFS S3 | `http://127.0.0.1:8333` | Raw object storage |

All published ports bind to loopback. Containers communicate through the isolated
`data-platform` bridge network and retain state in separate named volumes.

## Stop safely

```powershell
docker compose down
```

This preserves named volumes. `docker compose down --volumes` deletes all local
source, warehouse, and object-storage data and should be used only deliberately.

## Verify without starting containers

```powershell
python -m pytest tests/test_compose.py
docker compose config --quiet
```

The Python test checks the intended service boundaries. Docker Compose remains the
authoritative parser and must pass before this foundation is considered runtime
verified.

## Image and storage decisions

- PostgreSQL is pinned to `17.11-alpine3.24`. PostgreSQL 17 uses
  `/var/lib/postgresql/data` for persistent data.
- SeaweedFS is pinned to `4.41` and runs its convenient all-in-one server with the
  S3 gateway enabled. The public pipeline interface remains S3-compatible.
- The committed S3 credentials are local placeholders matching `.env.example`.
  Production credentials must be supplied outside Git and restricted to the
  required bucket.

Official references:

- https://docs.docker.com/reference/compose-file/services/#healthcheck
- https://docs.docker.com/reference/compose-file/volumes/
- https://hub.docker.com/_/postgres
- https://github.com/seaweedfs/seaweedfs/blob/master/docker/README.md
- https://github.com/seaweedfs/seaweedfs/wiki/Amazon-S3-API
