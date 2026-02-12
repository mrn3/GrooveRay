/**
 * PM2 ecosystem file for GrooveRay production.
 *
 * Usage:
 *   1. Build frontend:  cd frontend && npm run build
 *   2. Start:           pm2 start ecosystem.config.cjs
 *   3. Other commands:  pm2 logs | pm2 restart grooveray | pm2 stop grooveray
 */
module.exports = {
  apps: [
    {
      name: 'grooveray',
      cwd: './backend',
      script: 'src/index.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Set if frontend is on a different host (e.g. https://yourdomain.com):
        // CORS_ORIGIN: 'https://yourdomain.com',
      },
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
