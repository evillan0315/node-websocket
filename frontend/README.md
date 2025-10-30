# Terminal Frontend

A React-based frontend application for interacting with the `node-websocket` terminal server.

## Features

-   **Interactive Terminal**: Powered by XTerm.js, providing a full-featured pseudo-terminal experience.
-   **WebSocket Communication**: Connects to the backend via Socket.IO for real-time command execution and output streaming.
-   **Material UI**: Utilizes Material UI v6 for a clean and responsive user interface.
-   **Tailwind CSS**: Uses Tailwind CSS v4 for utility-first styling and responsive design.
-   **Nanostores**: Lightweight state management for global application state.
-   **Dark/Light Mode**: Supports theme switching.

## Prerequisites

-   Node.js (v18 or higher)
-   npm or Yarn
-   The `node-websocket` backend server running (typically on `http://localhost:3003`)

## Installation

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

## Configuration

Create a `.env` file in the `frontend/` directory (if it doesn't exist) and configure the WebSocket server URL:

```env
VITE_WS_URL=http://localhost:3003
```

Adjust `VITE_WS_URL` if your backend is running on a different address or port.

## Running the Frontend

1.  **Ensure the `node-websocket` backend server is running.**

2.  **Start the frontend development server:**
    ```bash
    cd frontend
    npm run dev
    ```

    This will usually open the application in your browser at `http://localhost:5173` (or another available port).

## Project Structure

```
frontend/
├── public/
├── src/
│   ├── api/                  (Placeholder for API client, currently simplified)
│   ├── components/
│   │   ├── icons/            (Custom icons)
│   │   └── Terminal/         (Terminal-related components)
│   │       ├── services/     (Terminal-specific Socket.IO service)
│   │       ├── stores/       (Terminal-specific nanostore)
│   │       ├── types/        (Type definitions for terminal communication)
│   │       ├── Terminal.tsx
│   │       ├── TerminalDialog.tsx
│   │       ├── TerminalSettingsDialog.tsx
│   │       └── TerminalToolbar.tsx
│   ├── services/             (General services like socket client factory)
│   ├── stores/               (Global nanostores: auth, theme, file system, logging)
│   ├── utils/                (Utility functions like persistentAtom, strip-ansi)
│   ├── App.tsx               (Main application component, sets up routing and theming)
│   ├── main.tsx              (Entry point)
│   ├── index.css             (Tailwind base styles)
│   └── theme.ts              (Material UI theme configuration)
├── .env
├── .eslintrc.cjs
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── vite-env.d.ts
└── vite.config.ts
```
