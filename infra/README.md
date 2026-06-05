# Suzuhara Media Stack (MySQL + Frontend)

This folder contains a light-weight runtime bundle for the minimum viable media site stack:

- **MySQL 8.0** pre-provisioned with the domain schema and a bootstrap `developer` account.
- **FastAPI backend** wired to MySQL and local disk storage (`MEDIA_ROOT=/app/data/media`).
- **React + Vite** development server exposed on http://localhost:5173 with environment wiring for the FastAPI API.

## Folder layout

- `docker-compose.yml` – orchestrates the MySQL service, FastAPI backend, and Vite dev server.
- `mysql/init.sql` – creates the schema defined in the product spec and seeds a developer user (`developer / ChangeMe123!`).
- `frontend.env` – environment variables passed into the Vite container (`VITE_API_BASE`).
- `data/` – bind-mounted volumes for persistent MySQL and media assets storage.
- `start-ui.sh` – one-command launcher that ensures MySQL is running and then opens the UI dev server.
- `backend.env` / `backend.env.example` – runtime configuration for the FastAPI container (cookie auth, DB URL, media paths).

## Usage

From the repository root:

```bash
./infra/start-ui.sh
```

The script will:

1. Start MySQL in detached mode (port `3306`).
2. Build & start the FastAPI backend on port `8000` in detached mode.
3. Run the Vite dev server in the foreground on port `5173` so you can stop it with `Ctrl+C`.

Once the UI is running you can connect your FastAPI backend (either locally or in Docker) using the example settings in `infra/backend.env.example`.

To stop the services that continue running in the background:

```bash
(cd infra && docker compose down)
```

## Notes for backend integration

- The connection string expected by the backend is `mysql+pymysql://media_app:media_app_pass@mysql:3306/suzuhara_media`.
- The schema matches the entities defined in the spec (users, albums, media, tags/media_tags) and seeds a `developer` role account.
- Media files can be stored under `/app/data/media` inside the container; the compose file maps this to `infra/data/media` so assets persist on the host.
- CORS and credentialed JWT cookies are pre-configured for `http://localhost:5173`.