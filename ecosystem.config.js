module.exports = {
  apps: [
    {
      name: 'yaadobot',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: process.env.PM2_MAX_MEMORY || '1200M',
      node_args: process.env.NODE_MAX_OLD_SPACE || '--max-old-space-size=1024',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
}
