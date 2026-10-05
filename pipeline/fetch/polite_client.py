import time
import urllib.parse
import urllib.request
from collections.abc import Callable, Mapping
from typing import Protocol
from urllib.error import HTTPError, URLError

#: Statuses that mean the server is busy or briefly broken, so the request is worth sending again.
RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
#: How many times a request is sent before giving up.
ATTEMPTS = 6
#: The pause before the first retry when the server doesn't say how long to wait; it doubles with each retry.
FIRST_BACKOFF_SECONDS = 2.0
#: How long to wait for a server to answer.
TIMEOUT_SECONDS = 60


class HttpClient(Protocol):
    """What the fetch step needs from HTTP: the bytes of a GET, and of a form POST."""

    def get(self, url: str) -> bytes: ...

    def post(self, url: str, form: Mapping[str, str], accept: str = '*/*') -> bytes: ...


class PoliteClient:
    """
    Sends HTTP requests one at a time, starting each at least `min_interval` seconds after the
    last, with a User-Agent that names the project, as Wikimedia's robot policy asks. A busy
    server (429, 5xx) or a dropped connection gets the request again after a pause: as long as
    the server's Retry-After says, or else a backoff that doubles each time.

    Every retry is logged, so a long run shows when a server slows it down.

    Proxy: stands in for urllib's urlopen and adds the etiquette around it. The opener, clock and
    sleep are injected, so tests run without a network or real waiting.
    """

    def __init__(
        self,
        user_agent: str,
        min_interval: float,
        *,
        open_url: Callable = urllib.request.urlopen,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
        log: Callable[[str], None] = print,
    ) -> None:
        self._user_agent = user_agent
        self._min_interval = min_interval
        self._open_url = open_url
        self._clock = clock
        self._sleep = sleep
        self._log = log
        self._last_start = float('-inf')

    def get(self, url: str) -> bytes:
        return self._send(urllib.request.Request(url))

    def post(self, url: str, form: Mapping[str, str], accept: str = '*/*') -> bytes:
        body = urllib.parse.urlencode(form).encode()
        return self._send(urllib.request.Request(url, data=body, headers={'Accept': accept}))

    def _send(self, request: urllib.request.Request) -> bytes:
        request.add_header('User-Agent', self._user_agent)
        for attempt in range(ATTEMPTS):
            last = attempt == ATTEMPTS - 1
            self._wait_turn()
            try:
                with self._open_url(request, timeout=TIMEOUT_SECONDS) as response:
                    return response.read()
            except HTTPError as error:
                if error.code not in RETRY_STATUSES or last:
                    raise
                pause = _retry_after(error) or _backoff(attempt)
                problem = f'HTTP {error.code}'
                error.close()
            except (URLError, TimeoutError, ConnectionError) as error:
                if last:
                    raise
                pause = _backoff(attempt)
                problem = str(error)
            self._log(f'{problem} from {urllib.parse.urlsplit(request.full_url).netloc}; trying again in {pause:g} s')
            self._sleep(pause)
        raise AssertionError('unreachable: the last attempt returns or raises')

    def _wait_turn(self) -> None:
        wait = self._last_start + self._min_interval - self._clock()
        if wait > 0:
            self._sleep(wait)
        self._last_start = self._clock()


def _retry_after(error: HTTPError) -> float | None:
    """The pause a busy server asks for in seconds, if it gives one as a number."""
    value = error.headers.get('Retry-After') if error.headers else None
    try:
        return float(value) if value else None
    except ValueError:
        return None


def _backoff(attempt: int) -> float:
    return FIRST_BACKOFF_SECONDS * 2**attempt
