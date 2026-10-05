import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from urllib.error import HTTPError, URLError

from polite_client import HttpClient

#: How often the downloader reports its progress, in images.
PROGRESS_EVERY = 250
SECONDS_PER_HOUR = 3600


@dataclass(frozen=True, slots=True)
class ImageFile:
    """An image to download, and where it goes."""

    url: str
    #: Its path inside the download folder.
    path: str


@dataclass(slots=True)
class DownloadReport:
    downloaded: int = 0
    #: Images already in the folder from an earlier run.
    skipped: int = 0
    #: The paths of images that failed even after the client's retries.
    failed: list[str] = field(default_factory=list)


class ImageDownloader:
    """
    Downloads images into a folder, one at a time through the client, skipping those already
    there, so a stopped run resumes where it left off. Each image is written under a temporary
    name and renamed once complete, so a run stopped mid-download never leaves half an image.
    A failed image is reported and the rest go on; the next run tries it again.
    """

    def __init__(
        self,
        client: HttpClient,
        folder: Path,
        log: Callable[[str], None] = print,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._client = client
        self._folder = folder
        self._log = log
        self._clock = clock

    def download(self, images: Sequence[ImageFile]) -> DownloadReport:
        report = DownloadReport()
        started = self._clock()
        for done, image in enumerate(images, start=1):
            self._fetch(image, report)
            if done % PROGRESS_EVERY == 0:
                self._log_progress(report, done, len(images), self._clock() - started)
        return report

    def _fetch(self, image: ImageFile, report: DownloadReport) -> None:
        target = self._folder / image.path
        if target.exists():
            report.skipped += 1
            return
        try:
            data = self._client.get(image.url)
        except (URLError, TimeoutError, ConnectionError) as error:
            if isinstance(error, HTTPError):
                error.close()
            report.failed.append(image.path)
            self._log(f'Failed {image.path}: {error}')
            return
        target.parent.mkdir(parents=True, exist_ok=True)
        partial = target.with_name(f'{target.name}.part')
        partial.write_bytes(data)
        partial.replace(target)
        report.downloaded += 1

    def _log_progress(self, report: DownloadReport, done: int, total: int, elapsed: float) -> None:
        line = f'{done:,}/{total:,} images: {report.downloaded:,} downloaded, {report.skipped:,} already there, {len(report.failed):,} failed'
        if report.downloaded:
            hours_left = elapsed / report.downloaded * (total - done) / SECONDS_PER_HOUR
            line += f', about {hours_left:.1f} h left'
        self._log(line)
