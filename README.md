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
