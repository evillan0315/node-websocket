  module.exports = {
  apps: [
    {
      name: "node-websocket",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        // PM2-specific environment variables for static serving
        //PM2_SERVE_PATH: "./dist/index.js", // ⬅️ The folder to serve (your Vite output)
        PORT: 3000,    // ⬅️ The port your app will run on
        //PM2_SERVE_SPA: "true",   // ⬅️ CRITICAL for SPAs (redirects 404s to index.html)
        // Optional: Can add other standard env variables here
        NODE_ENV: "production",
      },
      out_file: "./logs/combined.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm Z"
    }
  ]
};
