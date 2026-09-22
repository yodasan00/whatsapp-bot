module.exports = {
  apps: [
    {
      name: 'yaadobot',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '600M', // Prevents RAM exhaustion on e2-micro (1GB RAM)
      node_args: '--max-old-space-size=450',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
}
