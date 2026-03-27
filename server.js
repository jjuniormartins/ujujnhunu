const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;
const WATCH_FILES = ['relatorio-ribamar.html', 'index.html'];

// SSE clients
const clients = new Set();

const LIVE_RELOAD_SCRIPT = `
<script>
(function(){
  const es = new EventSource('/__reload');
  es.onmessage = () => location.reload();
  es.onerror = () => { es.close(); setTimeout(() => location.reload(), 1000); };
})();
</script>
`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  // SSE endpoint for live reload
  if (req.url === '/__reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('retry: 1000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  // Resolve file path
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/relatorio-ribamar.html';
  const filePath = path.join(ROOT, urlPath);

  // Security: stay within ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + urlPath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });

    if (ext === '.html') {
      // Inject live reload script before </body>
      const html = data.toString().replace('</body>', LIVE_RELOAD_SCRIPT + '</body>');
      res.end(html);
    } else {
      res.end(data);
    }
  });
});

// File watcher — broadcast reload to all SSE clients
function notifyReload(filename) {
  console.log(`[reload] ${filename} changed`);
  for (const client of clients) {
    client.write('data: reload\n\n');
  }
}

WATCH_FILES.forEach(file => {
  const fullPath = path.join(ROOT, file);
  if (fs.existsSync(fullPath)) {
    fs.watch(fullPath, () => notifyReload(file));
    console.log(`Watching: ${file}`);
  }
});

server.listen(PORT, () => {
  console.log(`\n  Live app running at http://localhost:${PORT}\n`);
});
