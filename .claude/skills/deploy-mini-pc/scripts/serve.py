#!/usr/bin/env python3
"""Tiny static file server for the Spindle build, with SvelteKit-friendly routing.

Runs on the mini-pc under systemd. Standard library only, so the host needs nothing
beyond python3.

Routing:
  /api/*        -> proxied to the PostgREST container (--api), so the site and its
                   data share one origin and need no CORS
  /foo          -> foo.html if it exists (prerendered SvelteKit pages)
  /foo/         -> foo/index.html
  anything else -> index.html (SPA fallback from adapter-static)
"""

from __future__ import annotations

import argparse
import functools
import os
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


API_PREFIX = "/api/"
MAX_BODY_BYTES = 3 * 1024 * 1024
# Request headers PostgREST needs; everything else (cookies, auth) stays behind.
FORWARD_REQUEST_HEADERS = ("Accept", "Content-Type", "Prefer", "Range")
FORWARD_RESPONSE_HEADERS = ("Content-Type", "Content-Range", "Preference-Applied")


class SpindleHandler(SimpleHTTPRequestHandler):
    api_upstream: str | None = None

    def do_GET(self) -> None:
        if self._is_api():
            self._proxy()
        else:
            super().do_GET()

    def do_HEAD(self) -> None:
        if self._is_api():
            self._proxy()
        else:
            super().do_HEAD()

    def do_POST(self) -> None:
        self._proxy_or_405()

    def do_PATCH(self) -> None:
        self._proxy_or_405()

    def _is_api(self) -> bool:
        return self.path.startswith(API_PREFIX)

    def _proxy_or_405(self) -> None:
        if self._is_api():
            self._proxy()
        else:
            self.send_error(405)

    def _proxy(self) -> None:
        if not self.api_upstream:
            self.send_error(404, "No API configured")
            return

        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY_BYTES:
            self.send_error(413)
            return
        body = self.rfile.read(length) if length else None

        request = urllib.request.Request(
            self.api_upstream + self.path[len(API_PREFIX) - 1 :],
            data=body,
            method=self.command,
            headers={
                name: self.headers[name]
                for name in FORWARD_REQUEST_HEADERS
                if self.headers.get(name)
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                self._relay(response.status, response.headers, response.read())
        except urllib.error.HTTPError as error:
            self._relay(error.code, error.headers, error.read())
        except (urllib.error.URLError, TimeoutError) as error:
            self.log_error("API upstream unavailable: %s", error)
            self.send_error(502, "Database API unavailable")

    def _relay(self, status: int, headers, payload: bytes) -> None:
        self.send_response(status)
        for name in FORWARD_RESPONSE_HEADERS:
            if headers.get(name):
                self.send_header(name, headers[name])
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def translate_path(self, path: str) -> str:
        resolved = super().translate_path(path)
        if os.path.isfile(resolved):
            return resolved
        if os.path.isdir(resolved):
            index = os.path.join(resolved, "index.html")
            if os.path.isfile(index):
                return index
        html = resolved.rstrip("/") + ".html"
        if os.path.isfile(html):
            return html
        # Missing asset requests should 404, not get HTML back.
        if os.path.splitext(urlsplit(path).path)[1]:
            return resolved
        return os.path.join(self.directory, "index.html")

    def end_headers(self) -> None:
        path = urlsplit(self.path).path
        if path.startswith(API_PREFIX):
            self.send_header("Cache-Control", "no-store")
        elif path.startswith("/_app/immutable/"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dir", required=True, help="directory containing the build")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--bind", default="0.0.0.0")
    parser.add_argument(
        "--api",
        help="PostgREST base URL to proxy /api/* to, e.g. http://127.0.0.1:3000",
    )
    args = parser.parse_args()

    SpindleHandler.api_upstream = args.api.rstrip("/") if args.api else None
    handler = functools.partial(SpindleHandler, directory=os.path.abspath(args.dir))
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    print(f"Serving {args.dir} on http://{args.bind}:{args.port}", flush=True)
    if SpindleHandler.api_upstream:
        print(f"Proxying {API_PREFIX}* to {SpindleHandler.api_upstream}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
