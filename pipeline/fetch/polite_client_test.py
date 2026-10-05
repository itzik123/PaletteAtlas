import io
import unittest
from email.message import Message
from urllib.error import HTTPError

from polite_client import PoliteClient


class FakeClock:
    """A clock that moves only when the client sleeps."""

    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def time(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


def too_many_requests(retry_after: int) -> HTTPError:
    headers = Message()
    headers['Retry-After'] = str(retry_after)
    return HTTPError('https://example.org', 429, 'Too Many Requests', headers, io.BytesIO())


class PoliteClientTest(unittest.TestCase):
    def test_waits_as_long_as_a_busy_server_asks_then_tries_again(self) -> None:
        clock = FakeClock()
        answers: list[HTTPError | bytes] = [too_many_requests(7), b'painting']
        agents = []

        def open_url(request, timeout):
            agents.append(request.get_header('User-agent'))
            answer = answers.pop(0)
            if isinstance(answer, HTTPError):
                raise answer
            return io.BytesIO(answer)

        logged = []
        client = PoliteClient('Test/1.0', 0, open_url=open_url, clock=clock.time, sleep=clock.sleep, log=logged.append)
        self.assertEqual(client.get('https://example.org/a.jpg'), b'painting')
        self.assertEqual(clock.sleeps, [7])
        self.assertEqual(agents, ['Test/1.0', 'Test/1.0'])
        self.assertEqual(logged, ['HTTP 429 from example.org; trying again in 7 s'])

    def test_starts_requests_at_least_the_minimum_interval_apart(self) -> None:
        clock = FakeClock()
        starts = []

        def open_url(request, timeout):
            starts.append(clock.now)
            return io.BytesIO(b'')

        client = PoliteClient('Test/1.0', 0.5, open_url=open_url, clock=clock.time, sleep=clock.sleep)
        for _ in range(3):
            client.get('https://example.org/')
        self.assertEqual(starts, [0, 0.5, 1.0])


if __name__ == '__main__':
    unittest.main()
