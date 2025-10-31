  module.exports = {
  apps: [
    {
      name: "node-websocket",
      script: "node dist/index.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
        PORT: 3000
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000
      },
      out_file: "./logs/combined.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm Z"
    }
  ]
};
