import { existsSync, statSync, createReadStream } from "node:fs";
import { resolve, normalize, extname } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

export function tryServeStatic(
  request: IncomingMessage,
  response: ServerResponse,
  baseDir: string,
): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  const rawUrl = request.url?.split("?")[0] ?? "/";
  let pathname = decodeURIComponent(rawUrl);
  if (pathname === "/" || pathname === "") {
    pathname = "/index.html";
  }

  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(baseDir, `.${safePath}`);

  // Prevent directory traversal attacks
  if (!filePath.startsWith(baseDir)) {
    return false;
  }

  if (!existsSync(filePath)) {
    return false;
  }

  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) {
      return false;
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

    response.writeHead(200, {
      "content-type": contentType,
      "content-length": stat.size,
      "cache-control": "no-cache, no-store, must-revalidate",
    });

    if (request.method === "HEAD") {
      response.end();
      return true;
    }

    createReadStream(filePath).pipe(response);
    return true;
  } catch {
    return false;
  }
}
