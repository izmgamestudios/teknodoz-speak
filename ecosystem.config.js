// PM2 ile çalıştırmak için: pm2 start ecosystem.config.js && pm2 save
module.exports = {
  apps: [{
    name: 'teknodoz-speak',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOST: '127.0.0.1',
      DATA_DIR: './data',
      SYNC_ENABLED: '0' // '1' yaparsan isteğe bağlı cihazlar arası eşitleme açılır
    }
  }]
};
