# Node.js WebSocket Terminal Server

A robust Node.js WebSocket server providing an interactive terminal experience, including local shell access, SSH connectivity, and command history logging. It's built for seamless integration with a web-based client application.

## Table of Contents
- [Repository](#repository)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Running the Server](#running-the-server)
- [Dockerization](#dockerization)
- [Kubernetes Deployment](#kubernetes-deployment)
- [API Endpoints](#api-endpoints)
  - [WebSocket Namespace: `/terminal`](#websocket-namespace-terminal)
  - [REST API Endpoints](#rest-api-endpoints)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Repository
- [GitHub](https://github.com/evillan0315/node-websocket)

## Features

-   **Interactive Local Terminal**: Provides a full-featured pseudo-terminal (PTY) via WebSockets, allowing clients to execute commands on the server's local machine.
-   **SSH Client**: Connects to remote SSH servers and streams output back to the client, enabling remote shell access.
-   **Command History**: Persists all executed commands (local and SSH) to a PostgreSQL database, linked to terminal sessions.
-   **Dynamic CWD Management**: Clients can dynamically change the current working directory (CWD) for local terminal sessions.
-   **Package Script Detection**: Identifies and lists `npm`, `yarn`, or `pnpm` scripts (`package.json`) in a given project root.
-   **One-off Command Execution**: Exposes REST API endpoints for non-interactive local and SSH command execution.
-   **Configurable Default Shell**: Supports `bash`, `powershell.exe`, etc., based on environment.
-   **Anonymous User Support**: Currently operates without explicit user authentication, associating sessions with an anonymous user ID (designed for integration where authentication might be handled upstream or not required).

## Tech Stack

-   **Node.js**: Runtime environment (v22+ recommended).
-   **Express.js**: Fast, unopinionated, minimalist web framework for REST API.
-   **Socket.IO**: Real-time bidirectional event-based communication.
-   **node-pty**: Pseudo-terminal for spawning and communicating with system shells.
-   **ssh2**: SSH client for Node.js.
-   **Prisma**: Next-generation ORM for database access.
-   **PostgreSQL**: Relational database for session and command history.
-   **TypeScript**: Statically typed superset of JavaScript.
-   **dotenv**: Loads environment variables from a `.env` file.
-   **jsonwebtoken**: (Dependency, but authentication is currently removed and not actively used).
-   **node-fetch**: (Dependency, currently unused in the server logic).

## Prerequisites

Before you begin, ensure you have the following installed:

-   [Node.js](https://nodejs.org/en/) (v22 or higher)
-   [npm](https://www.npmjs.com/) (usually comes with Node.js) or [Yarn](https://yarnpkg.com/)
-   [PostgreSQL](https://www.postgresql.org/) database server
-   [Docker](https://www.docker.com/get-started) (for Dockerization and Kubernetes)
-   [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/) (for Kubernetes deployment)

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/evillan0315/node-websocket
    cd node-websocket
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

## Configuration

Create a `.env` file in the project root based on the `.env.example` (or the default values implied by `src/config.ts`):

```env
PORT=3000
# JWT_SECRET is present in .env but currently unused as authentication is removed.
JWT_SECRET=YOUR_RANDOM_SECRET_KEY

# PostgreSQL database connection string
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/websocket?schema=public"

# Optional: Base directory for local terminal sessions (e.g., '/app').
# If empty, defaults to user's home directory or OS root.
BASE_DIR=

# Default shell for local terminal sessions (e.g., 'bash' on Linux/macOS, 'powershell.exe' on Windows).
SHELL_DEFAULT=bash
```

## Database Setup

This project uses Prisma for database management. After configuring your `DATABASE_URL` in `.env`, run the migrations to set up your database schema:

```bash
npm run prisma:migrate:dev
```

This command will create the `_prisma_migrations` table and apply the latest schema changes to your PostgreSQL database. Prisma will also generate the client based on your `schema.prisma`.

## Running the Server

### Development Mode

Uses `ts-node-dev` for live reloading during development:

```bash
npm run dev
```

### Production Mode

First, build the TypeScript project, then start the compiled JavaScript:

```bash
npm run build
npm start
```

## Dockerization

The project uses a multi-stage `Dockerfile` to create optimized Docker images. This approach separates the build environment (which includes development dependencies like TypeScript and Prisma CLI) from the runtime environment (which only contains production dependencies and the compiled application).

### Dockerfile Stages
-   **`builder`**: This stage compiles the TypeScript code, generates the Prisma client, and installs all `devDependencies`. This image can be used as an `initContainer` in Kubernetes for running database migrations.
-   **`runner`**: This is the final production image. It copies the built artifacts from the `builder` stage and installs only `production` dependencies, resulting in a smaller and more secure image.

### Build Docker Images
To build both the builder and the final application image, navigate to the project root and run:

```bash
# Build the 'builder' image (used for migrations in Kubernetes initContainer)
docker build -t node-websocket-builder:latest . --target builder

# Build the 'runner' image (the main application image)
docker build -t node-websocket:latest .
```

### Run with Docker
To run the application locally using Docker, you'll need to provide environment variables, especially the `DATABASE_URL`. Ensure your PostgreSQL database is accessible from within the Docker container (e.g., by running `docker network create my-app-network` and attaching your DB container to it, or by using `host.docker.internal` for local DB access if on Docker Desktop).

```bash
# Example: Run the application, connecting to a local PostgreSQL instance
# Make sure your database is running and accessible (e.g., on host.docker.internal:5432 or a Docker network)

docker run -d \
  --name node-websocket-app \
  -p 3000:3000 \
  -e PORT=3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/websocket?schema=public" \
  -e BASE_DIR="/app" \
  -e SHELL_DEFAULT="bash" \
  node-websocket:latest

# To stop and remove the container:
docker stop node-websocket-app
docker rm node-websocket-app
```

## Kubernetes Deployment

This project includes basic Kubernetes manifests for deploying the Node.js WebSocket server. The deployment setup ensures that Prisma migrations are run before the application pods start, and handles environment variables securely using Kubernetes Secrets.

**Note on Scaling**: Currently, this application manages WebSocket sessions in-memory. For robust, highly available deployments, scaling beyond a single replica will require externalizing the session state (e.g., using Redis, PostgreSQL for session storage) to ensure clients can reconnect to any available pod without losing their session context.

### 1. Create the Kubernetes Secret

First, create a Kubernetes Secret to store sensitive environment variables like `DATABASE_URL`. The `node-websocket-secret.yaml` file provides a template. You **must** replace the placeholder `DATABASE_URL` value with your actual base64-encoded database connection string.

To encode your `DATABASE_URL`:
```bash
echo -n "your_actual_postgresql_connection_string" | base64
```

Update `kubernetes/node-websocket-secret.yaml` with the encoded value, then apply it:

```bash
kubectl apply -f kubernetes/node-websocket-secret.yaml
```

### 2. Build and Push Docker Images

Ensure you have built the Docker images as described in the [Build Docker Images](#build-docker-images) section. If deploying to a remote cluster, you must push these images to a container registry (e.g., Docker Hub, Google Container Registry, AWS ECR) that your Kubernetes cluster can access.

```bash
# Example for Docker Hub (replace 'your-dockerhub-username')
docker tag node-websocket-builder:latest your-dockerhub-username/node-websocket-builder:latest
docker push your-dockerhub-username/node-websocket-builder:latest

docker tag node-websocket:latest your-dockerhub-username/node-websocket:latest
docker push your-dockerhub-username/node-websocket:latest
```

Then, update the `image` fields in `kubernetes/node-websocket-deployment.yaml` to point to your registry-specific image names (e.g., `your-dockerhub-username/node-websocket-builder:latest`).

### 3. Deploy the Application

Apply the Deployment and Service manifests. The deployment uses an `initContainer` to run Prisma migrations before the main application starts, ensuring your database schema is up-to-date.

```bash
kubectl apply -f kubernetes/node-websocket-deployment.yaml
kubectl apply -f kubernetes/node-websocket-service.yaml
```

### 4. Verify Deployment

Check the status of your pods and service:

```bash
kubectl get pods -l app=node-websocket
kubectl get svc node-websocket-service
```

If you're using a `ClusterIP` service (as in `node-websocket-service.yaml`), the service will only be accessible within the cluster. For external access, consider changing the service `type` to `LoadBalancer` (if your cloud provider supports it) or setting up an Ingress controller.

## API Endpoints

### WebSocket Namespace: `/terminal`

All real-time terminal interactions happen over the `/terminal` Socket.IO namespace.

-   **`connection`**: Initiates a new terminal session. On connection, the server emits `outputMessage`, `outputPath`, `outputInfo`, and `prompt`.
    -   Query parameter `initialCwd`: (Optional) Specifies the initial current working directory for the session.
-   **`input`**: Sends raw input data to the underlying PTY or SSH stream. (e.g., keyboard presses).
-   **`resize`**: Resizes the PTY or SSH terminal window.
    -   Payload: `{ cols: number; rows: number; }`
-   **`set_cwd`**: Changes the current working directory for the local terminal session.
    -   Payload: `{ cwd: string; }`
-   **`exec_terminal`**: Executes a command in the local terminal, optionally changing CWD before execution.
    -   Payload: `{ command?: string; newCwd?: string; }`
-   **`ssh-connect`**: Initiates an SSH connection to a remote host.
    -   Payload: `{ host: string; port?: number; username: string; password?: string; privateKeyPath?: string; }`
-   **`disconnect`**: Handled automatically when the client disconnects.

**Emitted Events (from server to client):**

-   **`output`**: Raw output from the terminal (local PTY or SSH).
-   **`outputMessage`**: General informational messages.
-   **`outputPath`**: Current working directory.
-   **`outputInfo`**: OS information for the server.
-   **`prompt`**: Current CWD and a hint for the command input.
-   **`error`**: Error messages from the server.
-   **`close`**: Indicates the terminal session or SSH connection has closed.

### REST API Endpoints

-   **`POST /api/terminal/ssh/run`**
    -   **Description**: Executes a single SSH command on a remote server and returns its output.
    -   **Request Body**: `SshCommandDto` - `{ host: string; port?: number; username: string; password?: string; privateKeyPath?: string; command: string; }`
    -   **Response**: `{ message: string; output: string; }` or error.

-   **`POST /api/terminal/run`**
    -   **Description**: Executes a single local command on the server and returns its output.
    -   **Request Body**: `TerminalCommandDto` - `{ command: string; cwd: string; }`
    -   **Response**: `{ stdout: any[]; stderr: any[]; exitCode: number; }` or error.

-   **`POST /api/terminal/package-scripts`**
    -   **Description**: Retrieves `package.json` scripts and detected package manager for a given project root.
    -   **Request Body**: `GetPackageScriptsDto` - `{ projectRoot: string; }`
    -   **Response**: `{ scripts: PackageScript[]; packageManager: PackageManager; }` or error.

## Project Structure

```
node-websocket/
├── .env
├── Dockerfile
├── kubernetes/
│   ├── node-websocket-deployment.yaml
│   ├── node-websocket-secret.yaml
│   └── node-websocket-service.yaml
├── package.json
├── prisma/
│   └── schema.prisma
├── src/
│   ├── auth/           (Authentication related enums - currently not actively used)
│   ├── config.ts       (Environment configuration variables)
│   ├── index.ts        (Main server entry point, Socket.IO and Express setup)
│   ├── prisma.ts       (Prisma client instance)
│   ├── terminal/
│   │   ├── terminal.service.ts (Core logic for PTY, SSH, and database operations)
│   │   └── terminal.types.ts   (TypeScript interfaces and DTOs for terminal module)
│   ├── types/          (General type definitions)
│   └── utils/
│       └── logger.ts   (Custom console logger)
└── tsconfig.json
```

## Contributing

Contributions are welcome! Please feel free to open issues or submit pull requests.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## 📧 Contact

Eddie Villanueva - [evillan0315@gmail.com](mailto:evillan0315@gmail.com)
[LinkedIn](https://www.linkedin.com/in/eddie-villalon/)
[GitHub](https://github.com/evillan0315)
