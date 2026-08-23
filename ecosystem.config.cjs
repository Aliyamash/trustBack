module.exports = {
  apps: [
    {
      name: "trustence-api",
      script: "./src/server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "600M",
      env: { NODE_ENV: "production" },
    },
  ],
};
