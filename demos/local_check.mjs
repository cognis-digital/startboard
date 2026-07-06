// Hermetic demo of `startboard check`: spins up a local HTTP server, then runs
// the check pipeline against it plus a known-dead TCP port. No external network.
// Exits 0 on success, non-zero otherwise.
import http from "node:http";
import { checkAll } from "../src/check.js";

const srv = http.createServer((_req, res) => {
  res.writeHead(200);
  res.end("ok");
});

await new Promise((resolve) => srv.listen(0, "127.0.0.1", resolve));
const port = srv.address().port;

try {
  const config = {
    title: "demo",
    status: [
      { name: "local HTTP", type: "tcp", url: `127.0.0.1:${port}`, timeoutMs: 1000 },
      { name: "dead port", type: "tcp", url: "127.0.0.1:1", timeoutMs: 500 },
    ],
  };
  const results = await checkAll(config, { concurrency: 2 });
  for (const r of results) {
    console.log(`    [${r.state.toUpperCase()}] ${r.name} (${r.url}) — ${r.ms}ms ${r.error || ""}`.trimEnd());
  }
  const up = results.find((r) => r.name === "local HTTP");
  const dead = results.find((r) => r.name === "dead port");
  if (up.state !== "up") throw new Error(`expected local port up, got ${up.state}`);
  if (dead.state === "up") throw new Error("dead port should not be up");
} finally {
  srv.close();
}
