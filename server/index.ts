import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { loadLocalEnv } from "./env";
import { handleGenerateConstellation } from "./handler";
import { tryServeStatic } from "./staticServer";

loadLocalEnv();

const landingDir = resolve(__dirname, "../landing");

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

async function toWebRequest(request: IncomingMessage): Promise<Request> {
  const host = request.headers.host ?? "127.0.0.1:8787";
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await readBody(request);
  return new Request(`http://${host}${request.url ?? "/"}`, {
    method: request.method,
    headers: request.headers as HeadersInit,
    body,
  });
}

function writeResponse(nodeResponse: ServerResponse, response: Response): void {
  void response.arrayBuffer().then((buffer) => {
    const headers = Object.fromEntries(response.headers.entries());
    nodeResponse.writeHead(response.status, headers);
    nodeResponse.end(Buffer.from(buffer));
  });
}

const server = createServer((request, nodeResponse) => {
  if (request.method === "GET" && request.url === "/health") {
    nodeResponse.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    nodeResponse.end(JSON.stringify({ ok: true }));
    return;
  }
  if (request.url?.startsWith("/api/generate-constellation")) {
    void toWebRequest(request)
      .then((webRequest) => handleGenerateConstellation(webRequest))
      .then((response) => writeResponse(nodeResponse, response))
      .catch(() => {
        nodeResponse.writeHead(500, { "content-type": "application/json" });
        nodeResponse.end(JSON.stringify({ error: "generation_failed" }));
      });
    return;
  }
  if (tryServeStatic(request, nodeResponse, landingDir)) {
    return;
  }
  nodeResponse.writeHead(404);
  nodeResponse.end();
});

const port = Number(process.env.PORT ?? 8787);
server.listen(port, "0.0.0.0", () => {
  console.log(`constellation api listening on ${port}`);
});
