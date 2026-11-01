// Deliberately serve only these demo assets, never the project or its .git data.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/standalone.css", ["standalone.css", "text/css; charset=utf-8"]],
  ["/film.css", ["film.css", "text/css; charset=utf-8"]],
  ["/omega.js", ["omega.js", "text/javascript; charset=utf-8"]],
  ["/motion.js", ["motion.js", "text/javascript; charset=utf-8"]],
  ["/film.js", ["film.js", "text/javascript; charset=utf-8"]],
]);
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const resource = files.get(pathname);
  if (!resource || !["GET", "HEAD"].includes(request.method)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "Content-Type": resource[1],
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'",
  });
  const contents = fs.readFileSync(path.resolve(__dirname, "..", "demo", resource[0]));
  response.end(request.method === "HEAD" ? undefined : contents);
});
server.listen(Number(process.env.OMEGA_PREVIEW_PORT || 4173), "127.0.0.1", () => {
  console.log(`Omega Code preview: http://127.0.0.1:${server.address().port}`);
});
