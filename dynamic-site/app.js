const http = require('http');

const PORT = 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    task: 'Task 22 - Dynamic Website Hosting',
    server: 'Node.js behind Nginx reverse proxy',
    time: new Date().toISOString(),
  }));
}).listen(PORT, () => console.log(`listening on ${PORT}`));
