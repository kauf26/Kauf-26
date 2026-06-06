#!/usr/bin/env python3
"""
Parallel image ingestion for scraper pipelines.

Uses asyncio + aiohttp to download image URLs concurrently without blocking
the main scraper loop. Schedule downloads with schedule(); optionally drain
with await ingestor.wait() at shutdown.

Install: pip install aiohttp

Example (scraper does not await each download):

    ingestor = ImageIngestor("./data/images", max_concurrent=10)

    for listing in scraper.yield_listings():
        process_listing(listing)  # your logic
        for url in listing.get("image_urls", []):
            ingestor.schedule(url)  # returns immediately

    await ingestor.wait()  # optional: flush before exit
    ingestor.print_summary()
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import mimetypes
import re
import sys
import time
from pathlib import Path
from typing import Callable
from urllib.parse import unquote, urlparse

import aiohttp

DEFAULT_TIMEOUT_SECS = 30
DEFAULT_MAX_CONCURRENT = 10
CHUNK_SIZE = 64 * 1024


def _extension_from_url(url: str) -> str | None:
    path = unquote(urlparse(url).path)
    suffix = Path(path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".avif", ".heic"}:
        return suffix
    return None


def _extension_from_content_type(content_type: str | None) -> str:
    if not content_type:
        return ".jpg"
    mime = content_type.split(";")[0].strip().lower()
    ext = mimetypes.guess_extension(mime)
    if ext == ".jpe":
        return ".jpg"
    if ext:
        return ext
    return ".jpg"


def _unique_filename(url: str, content: bytes, content_type: str | None) -> str:
    digest = hashlib.sha256(url.encode("utf-8") + content[:4096]).hexdigest()[:16]
    ext = _extension_from_url(url) or _extension_from_content_type(content_type)
    safe_host = re.sub(r"[^a-z0-9]+", "-", urlparse(url).hostname or "img").strip("-")[:32]
    return f"{safe_host}_{digest}{ext}"


class ImageIngestor:
    """Fire-and-forget parallel image downloader."""

    def __init__(
        self,
        output_dir: str | Path,
        *,
        max_concurrent: int = DEFAULT_MAX_CONCURRENT,
        timeout_secs: float = DEFAULT_TIMEOUT_SECS,
        on_complete: Callable[[str, Path | None, str | None], None] | None = None,
    ) -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.max_concurrent = max_concurrent
        self.timeout = aiohttp.ClientTimeout(total=timeout_secs)
        self.on_complete = on_complete

        self._sem = asyncio.Semaphore(max_concurrent)
        self._tasks: set[asyncio.Task[None]] = set()
        self._session: aiohttp.ClientSession | None = None
        self._started_at = time.monotonic()

        self.scheduled = 0
        self.completed = 0
        self.succeeded = 0
        self.failed = 0
        self._lock = asyncio.Lock()

    async def __aenter__(self) -> ImageIngestor:
        await self._ensure_session()
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.close()

    async def _ensure_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=self.timeout,
                headers={"User-Agent": "Kauf26-ImageIngest/1.0"},
            )
        return self._session

    def schedule(self, url: str) -> None:
        """
        Queue a download without blocking the caller.
        Safe to call from the main scraper loop while other work continues.
        """
        url = url.strip()
        if not url or not url.startswith(("http://", "https://")):
            return

        self.scheduled += 1
        task = asyncio.create_task(self._download(url), name=f"img:{self.scheduled}")
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    def schedule_many(self, urls: list[str]) -> None:
        for url in urls:
            self.schedule(url)

    async def wait(self) -> None:
        """Wait for all in-flight downloads to finish."""
        if not self._tasks:
            return
        await asyncio.gather(*list(self._tasks), return_exceptions=True)

    async def close(self) -> None:
        await self.wait()
        if self._session and not self._session.closed:
            await self._session.close()
        self._session = None

    async def _download(self, url: str) -> None:
        async with self._sem:
            path: Path | None = None
            error: str | None = None
            try:
                session = await self._ensure_session()
                async with session.get(url, allow_redirects=True) as resp:
                    if resp.status != 200:
                        raise aiohttp.ClientResponseError(
                            resp.request_info,
                            resp.history,
                            status=resp.status,
                            message=resp.reason or "HTTP error",
                        )
                    content = await resp.read()
                    if not content:
                        raise ValueError("empty response body")

                    filename = _unique_filename(url, content, resp.headers.get("Content-Type"))
                    path = self.output_dir / filename
                    if path.exists():
                        # Same content hash collision is unlikely; add suffix.
                        path = self.output_dir / f"{path.stem}_{int(time.time() * 1000)}{path.suffix}"

                    path.write_bytes(content)
            except asyncio.TimeoutError:
                error = "timeout"
            except aiohttp.ClientError as exc:
                error = f"network: {exc}"
            except OSError as exc:
                error = f"io: {exc}"
            except Exception as exc:  # noqa: BLE001 — log and continue pipeline
                error = str(exc)

            async with self._lock:
                self.completed += 1
                if error:
                    self.failed += 1
                    status = f"FAIL ({error})"
                else:
                    self.succeeded += 1
                    status = f"OK -> {path.name if path else '?'}"

                pending = self.scheduled - self.completed
                print(
                    f"[ingest] {self.completed}/{self.scheduled} done "
                    f"(ok={self.succeeded} fail={self.failed} in-flight≈{pending}) "
                    f"{status} | {url[:80]}{'…' if len(url) > 80 else ''}",
                    flush=True,
                )

            if self.on_complete:
                self.on_complete(url, path, error)

    def print_summary(self) -> None:
        elapsed = time.monotonic() - self._started_at
        rate = self.completed / elapsed if elapsed > 0 else 0.0
        print(
            f"\n[ingest] Summary: scheduled={self.scheduled} "
            f"succeeded={self.succeeded} failed={self.failed} "
            f"elapsed={elapsed:.1f}s ({rate:.1f} img/s) -> {self.output_dir.resolve()}",
            flush=True,
        )


async def demo_scraper_loop(urls: list[str], output_dir: Path, max_concurrent: int) -> None:
    """
    Simulates a scraper that discovers image URLs and schedules downloads
    without awaiting each one.
    """
    async with ImageIngestor(output_dir, max_concurrent=max_concurrent) as ingestor:
        print(f"[scraper] Found {len(urls)} image URL(s); scheduling downloads…", flush=True)

        for i, url in enumerate(urls, start=1):
            # Main scraper work (parsing, DB writes, etc.) is not blocked here.
            print(f"[scraper] Processing listing {i}/{len(urls)}", flush=True)
            ingestor.schedule(url)
            await asyncio.sleep(0.05)  # simulate other scraper I/O

        print("[scraper] Loop finished — downloads still running in background", flush=True)
        await ingestor.wait()
        ingestor.print_summary()


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download scraper image URLs in parallel (asyncio + aiohttp)."
    )
    parser.add_argument(
        "urls",
        nargs="*",
        help="Image URLs to download (or pass via --file)",
    )
    parser.add_argument(
        "-f",
        "--file",
        type=Path,
        help="Text file with one image URL per line",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("./ingested_images"),
        help="Output directory (default: ./ingested_images)",
    )
    parser.add_argument(
        "-c",
        "--concurrency",
        type=int,
        default=DEFAULT_MAX_CONCURRENT,
        help=f"Max concurrent downloads (default: {DEFAULT_MAX_CONCURRENT})",
    )
    parser.add_argument(
        "-t",
        "--timeout",
        type=float,
        default=DEFAULT_TIMEOUT_SECS,
        help=f"Per-request timeout in seconds (default: {DEFAULT_TIMEOUT_SECS})",
    )
    return parser.parse_args(argv)


def load_urls(args: argparse.Namespace) -> list[str]:
    urls: list[str] = [u.strip() for u in args.urls if u.strip()]
    if args.file:
        if not args.file.is_file():
            raise SystemExit(f"URL file not found: {args.file}")
        urls.extend(
            line.strip()
            for line in args.file.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.strip().startswith("#")
        )
    if not urls:
        raise SystemExit("No URLs provided. Pass URLs as arguments or use --file.")
    return urls


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    urls = load_urls(args)

    if args.concurrency < 1:
        raise SystemExit("--concurrency must be >= 1")

    async def run() -> None:
        async with ImageIngestor(
            args.output,
            max_concurrent=args.concurrency,
            timeout_secs=args.timeout,
        ) as ingestor:
            ingestor.schedule_many(urls)
            await ingestor.wait()
            ingestor.print_summary()

    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\n[ingest] Interrupted.", flush=True)
        return 130
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
