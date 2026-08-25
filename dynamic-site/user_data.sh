#!/bin/bash
set -e
apt-get update -y
apt-get install -y nginx nodejs

mkdir -p /opt/app
cat > /opt/app/app.js <<'APP'
const http = require('http');
const PORT = 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    task: 'Task 22 - Dynamic Website Hosting',
    server: 'Node.js behind Nginx reverse proxy',
    time: new Date().toISOString(),
  }));
}).listen(PORT, () => console.log('listening on ' + PORT));
APP

cat > /etc/systemd/system/task22-app.service <<'UNIT'
[Unit]
Description=Task 22 dynamic app
After=network.target

[Service]
ExecStart=/usr/bin/node /opt/app/app.js
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now task22-app

cat > /etc/nginx/sites-available/task22 <<'NGINX'
server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/task22 /etc/nginx/sites-enabled/task22
systemctl restart nginx
systemctl enable nginx
