from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient


def test_health_endpoint_stays_within_a_bounded_load(client: TestClient) -> None:
    """64 concurrent health checks: every request succeeds inside a 5 s budget."""
    requests = 64

    def call() -> int:
        return client.get("/health").status_code

    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=8) as pool:
        statuses = list(pool.map(lambda _: call(), range(requests)))
    elapsed = time.perf_counter() - started

    assert statuses == [200] * requests
    assert elapsed < 5.0, f"{requests} concurrent health checks took {elapsed:.2f}s"
