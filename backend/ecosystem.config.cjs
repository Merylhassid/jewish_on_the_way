module.exports = {
  apps: [
    {
      name: 'jewish-on-the-way-api',
      cwd: '/srv/jewish-on-the-way/backend/current',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '900M',
      time: true,
      merge_logs: true,
      out_file: '/srv/jewish-on-the-way/backend/logs/api-out.log',
      error_file: '/srv/jewish-on-the-way/backend/logs/api-error.log',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
