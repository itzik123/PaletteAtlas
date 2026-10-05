import io
import unittest
from email.message import Message
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.error import HTTPError

from download import DownloadReport, ImageDownloader, ImageFile


class FakeClient:
    """Answers every URL with bytes naming it, except the ones it was told are gone."""

    def __init__(self, gone: frozenset[str] = frozenset()) -> None:
        self.requested: list[str] = []
        self._gone = gone

    def get(self, url: str) -> bytes:
        self.requested.append(url)
        if url in self._gone:
            raise HTTPError(url, 404, 'Not Found', Message(), io.BytesIO())
        return f'image from {url}'.encode()


def image(id: str) -> ImageFile:
    return ImageFile(url=f'https://upload.example/{id}.jpg', path=f'images/{id}.jpg')


class ImageDownloaderTest(unittest.TestCase):
    def test_downloads_each_missing_image_and_skips_those_already_there(self) -> None:
        with TemporaryDirectory() as directory:
            folder = Path(directory)
            (folder / 'images').mkdir()
            (folder / 'images/Q1.jpg').write_bytes(b'downloaded before')
            client = FakeClient()
            report = ImageDownloader(client, folder, log=lambda _: None).download([image('Q1'), image('Q2')])
            self.assertEqual(report, DownloadReport(downloaded=1, skipped=1, failed=[]))
            self.assertEqual(client.requested, ['https://upload.example/Q2.jpg'])
            self.assertEqual((folder / 'images/Q1.jpg').read_bytes(), b'downloaded before')
            self.assertEqual((folder / 'images/Q2.jpg').read_bytes(), b'image from https://upload.example/Q2.jpg')

    def test_reports_a_failed_download_and_goes_on_with_the_rest(self) -> None:
        with TemporaryDirectory() as directory:
            folder = Path(directory)
            client = FakeClient(gone=frozenset({'https://upload.example/Q1.jpg'}))
            report = ImageDownloader(client, folder, log=lambda _: None).download([image('Q1'), image('Q2')])
            self.assertEqual(report, DownloadReport(downloaded=1, skipped=0, failed=['images/Q1.jpg']))
            self.assertEqual(sorted(path.name for path in (folder / 'images').iterdir()), ['Q2.jpg'])


if __name__ == '__main__':
    unittest.main()
