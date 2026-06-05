# SuzuharaAPP 工程说明

这一版文档针对当前正在运行的 **Vite + React 前端**、**FastAPI 后端** 与 **MySQL** 数据栈，帮助你快速理解工程目录、配置文件、数据存储方式以及常见运维操作。

## 运行栈概览

| 服务            | 说明                                                   | 暴露端口               | 代码/配置入口                            |
|-----------------|--------------------------------------------------------|------------------------|-----------------------------------------|
| `web`           | Vite 前端开发服务器，向浏览器提供 React 单页应用       | `5173/tcp`             | `frontend/`, `infra/frontend.env`       |
| `api`           | FastAPI 应用，处理身份认证、媒体管理、社交模块等接口   | `8000/tcp`             | `backend/`, `.env.dev` / `infra/backend.env` |
| `mysql`         | MySQL 8.0 实例，保存所有结构化业务数据                 | `3306/tcp`             | `infra/mysql/init.sql`, `infra/data/mysql` |

以上服务通过 `infra/docker-compose.yml` 编排。前端请求默认指向 `http://localhost:8000`，并携带后端设置的 `access_token` HttpOnly Cookie。

## 目录速览

- `frontend/` – React 组件、路由、hooks 和静态资源。通过 `Vite` 启动开发服务。
- `backend/` – FastAPI 应用源码，SQLAlchemy 模型、依赖和路由都在 `app/` 目录。
- `infra/` – 实际使用的 Docker 部署脚本、环境文件与持久化目录。
  - `docker-compose.yml` – 同时启动 MySQL、后端与前端。
  - `docker-compose.prod.yml` – 生产部署用编排文件（Nginx + 构建后前端 + FastAPI + MySQL）。
  - `start-ui.sh` – 一键执行 `docker compose up`，前端以前台模式运行。
  - `backend.env` / `frontend.env` / `backend.prod.env` / `mysql.prod.env` – 开发/生产环境变量模板。
  - `data/` – 主机上的 MySQL 与媒体文件存放目录。
- `.env.dev` – 本地直接运行后端时使用的设置，变量与 `infra/backend.env` 保持一致。

> 根目录下旧版 `docker-compose.yml` 仍包含 MinIO + PostgreSQL 方案，但当前项目默认使用 `infra/` 内的 MySQL 架构。

## 环境变量与配置

### 后端（FastAPI）

文件：`.env.dev`、`infra/backend.env`

- `PORT=8000` – Uvicorn 监听端口。
- `DB_URL=mysql+pymysql://media_app:media_app_pass@mysql:3306/suzuhara_media` – 指向 compose 网络中的 MySQL。
- `JWT_SECRET=dev-secret-change-me` – 用于签名访问令牌，生产请替换。
- `JWT_EXPIRE_HOURS=8760` – 登录有效期（当前设置 1 年）。
- `CORS_ORIGINS=http://localhost:5173` – 允许携带 Cookie 的跨域来源。
- `MEDIA_ROOT=/app/data/media` – 媒体文件在容器内的存放路径，宿主映射到 `infra/data/media`。

### 前端（Vite + React）

文件：`infra/frontend.env`

- `VITE_API_BASE=http://localhost:8000` – axios 基础 URL。
- `VITE_MEDIA_PAGE_SIZE=24` – 媒体列表分页大小。

## 数据存储说明

### 关系数据库（MySQL）

- 数据库名：`suzuhara_media`
- 连接方式：`mysql -u media_app -pmedia_app_pass -h 127.0.0.1 -P 3306`
- 初始化脚本：`infra/mysql/init.sql`
- 核心表结构由 `backend/app/models.py` 中的 SQLAlchemy 模型定义，主要包括：
  - `users` – 登录账号，字段包含 `username`、`email`、`password_hash`、`role` 等。种子用户：`developer / ChangeMe123!`。
  - `albums` – 相册，关联 `users.id`，带有 `visibility`、`cover_media_id` 等字段。
  - `media` – 媒体资源元数据，包括类型（图片/视频）、尺寸、字节大小、SHA256 校验、存储路径等。
  - `tags` 与 `media_tags` – 媒体标签及多对多关系表。
  - `social_posts`、`social_media`、`social_replies` – 社交内容及其媒体附件。

### 媒体文件

- 上传的源文件存放在 `infra/data/media`（容器内挂载到 `/app/data/media`）。
- 后端 API 将文件的 `storage_path`、`preview_path` 等信息写入数据库，实际读取/删除操作也基于此目录。

## 本地运行方式

### 一键启动

```bash
./infra/start-ui.sh
```

脚本会依次：
1. 以守护进程方式启动 MySQL；
2. 构建并启动 FastAPI 容器（后台运行）；
3. 启动 Vite 前端（前台），按 `Ctrl+C` 可停止前端。

默认访问地址：
- 前端：http://localhost:5173
- 后端健康检查：http://localhost:8000/health
- MySQL：localhost:3306

### 手动使用 Docker Compose

```bash
cd infra
docker compose up -d        # 后台启动全部服务
docker compose logs -f web  # 查看前端日志
docker compose down         # 停止并保留数据卷
```

需要重置数据时，可执行 `docker compose down -v`（会删除 `infra/data` 下的持久化内容）。

### 浏览器登录

1. 打开 `http://localhost:5173/login`。
2. 使用账号 `developer` / 密码 `ChangeMe123!` 登录。
3. 后端会通过 `Set-Cookie: access_token=...` 返回 HttpOnly Cookie；只要浏览器地址是 `http://localhost:5173`，后续接口即可授权访问。

## 代码结构要点

- **后端入口**：`backend/app/main.py` – 设置中间件、异常处理、路由注册、启动时自动建表 (`init_db`)。
- **鉴权依赖**：`backend/app/deps.py` – 定义 `create_access_token`、`require_user` 等依赖，读取 Cookie 中的 JWT。
- **路由模块**：
  - `app/auth/routes.py` – 登录/注销/当前用户。
  - `app/albums/routes.py`、`app/media/routes.py`、`app/tags/routes.py`、`app/social/routes.py` – 各业务域的 CRUD。
- **前端 API 包装**：`frontend/src/api.js` – axios 实例配置，统一处理成功/错误响应。
- **状态管理**：`@tanstack/react-query` 存储当前用户、媒体列表等查询状态，相关 hooks 位于 `frontend/src/hooks/`。

## 常见运维动作

- **查看数据库数据**：
  ```bash
  docker compose exec mysql mysql -u media_app -pmedia_app_pass -D suzuhara_media
  ```
- **同步依赖**：`frontend/` 下使用 `npm install`，`backend/` 可在本机虚拟环境中执行 `pip install -r requirements.txt`（容器内镜像已预装）。
- **调整 JWT 或 CORS**：修改 `.env.dev` 或 `infra/backend.env` 后，运行 `docker compose restart api`。
- **修改前端环境**：编辑 `infra/frontend.env`，随后 `docker compose restart web`。

## 生产部署指南（Docker）

本仓库已经准备好生产环境所需的构建脚本，步骤如下：

1. **准备配置文件**
   ```bash
   cp infra/backend.prod.env infra/backend.prod.env.local   # 修改 JWT_SECRET / CORS / DB_URL 等敏感信息
   cp infra/mysql.prod.env infra/mysql.prod.env.local       # 修改数据库密码
   ```
   > 推荐将 `.local` 版本加入 `.gitignore`，避免把真实密码提交到仓库。

2. **构建镜像**
   ```bash
   cd infra
   docker compose -f docker-compose.prod.yml build
   ```
   `frontend` 服务会使用 `frontend/Dockerfile`，在构建阶段执行 `npm ci && npm run build` 并默认将 `VITE_API_BASE` 设置为 `/api`。如需指向其他域名，可通过 `--build-arg VITE_API_BASE=https://example.com/api` 覆盖。

3. **启动服务**
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```
   - `web` 服务由 Nginx 提供静态页与反向代理，配置文件位于 `infra/nginx.prod.conf`，默认监听 80 端口并将 `/api/*` 转发到 FastAPI。
   - `api` 服务使用 `backend/Dockerfile` 构建后的镜像，默认挂载 `infra/data/media` 以持久化上传文件。
   - `mysql` 服务挂载 `infra/data/mysql`，同时复用 `infra/mysql/init.sql` 初始化表结构。

4. **启用 HTTPS（可选但推荐）**
   - 在服务器上安装 `certbot`，或通过 cloud provider 申请证书。
   - 将证书路径写入 `infra/nginx.prod.conf`（监听 443，添加 `ssl_certificate` / `ssl_certificate_key`），并在 compose 中开放 443 端口：
     ```yaml
     ports:
       - "80:80"
       - "443:443"
     ```
   - 重启 `web` 服务：`docker compose -f docker-compose.prod.yml restart web`

5. **滚动更新**
   每次更新代码后：
   ```bash
   docker compose -f docker-compose.prod.yml build web api
   docker compose -f docker-compose.prod.yml up -d web api
   ```

> 生产环境下记得关闭未用端口、防火墙只开放 80/443，并将 `backend.prod.env` 中的 `CORS_ORIGINS` 设置为你的正式域名。

## 参考 API

- `POST /auth/login` – 登录并下发 Cookie。
- `GET /auth/me` – 查看当前用户。
- `GET /media?page=1&size=12` – 媒体分页列表。
- `POST /media/upload-credential` + `POST /media` – 媒体上传与落库流程。
- `GET /albums`、`GET /albums/{id}` – 相册管理。

> 完整接口定义位于 `backend/app` 对应的路由模块，并通过 FastAPI 自动生成的 OpenAPI 文档（访问 `http://localhost:8000/docs`）查看。

---

如需扩展 README，可继续在此基础上补充部署、监控或 CI/CD 说明。任何新的服务或环境变量，也请同步更新本文件，保持团队信息一致。***