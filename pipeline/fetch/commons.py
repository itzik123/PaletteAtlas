import json
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from itertools import batched
from typing import Any

from polite_client import HttpClient

COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
#: The width images are downloaded at: one of Wikimedia's standard thumbnail sizes, and more than
#: the strips need (they shrink every image to 256 px on its longer side).
DOWNLOAD_WIDTH = 500
#: Licenses whose files anyone may use without conditions. Commons marks a file `pd` only after
#: checking it is in the public domain in both the US and its source country.
FREE_LICENSES = frozenset({'pd', 'cc0'})
#: Image types the pipeline decodes. Commons serves TIFF thumbnails as JPEG.
RASTER_TYPES = frozenset({'image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'image/gif'})
#: The most titles the API takes in one request.
LOOKUP_BATCH = 50
#: Asks the API to refuse requests while its database replicas lag more than this many seconds
#: behind, as its etiquette recommends for scripts; a refused request is sent again later.
MAX_LAG_SECONDS = 5
MAX_LAG_ATTEMPTS = 10


@dataclass(frozen=True, slots=True)
class CommonsFile:
    """An image file on Wikimedia Commons."""

    #: Its name on Commons, without the "File:" prefix.
    name: str
    #: Its license, as Commons abbreviates it: `pd`, `cc0`, `cc-by-sa-4.0`, ...
    license: str
    mime: str
    width: int
    height: int
    #: Where to download it DOWNLOAD_WIDTH px wide.
    thumbnail: str


def is_usable(file: CommonsFile) -> bool:
    """Whether a file is free to use and an image the pipeline can read at DOWNLOAD_WIDTH."""
    return file.license in FREE_LICENSES and file.mime in RASTER_TYPES and file.width >= DOWNLOAD_WIDTH


def files_from_response(response: dict[str, Any], requested: Sequence[str]) -> dict[str, CommonsFile | None]:
    """
    Each requested file name's file in an imageinfo response, or None if Commons has no such file.
    The API answers under each file's final title, after normalizing the name (spaces for
    underscores, a capital first letter) and following redirects, so this follows them too.
    """
    query = response.get('query', {})
    renamed = {rename['from']: rename['to'] for rename in query.get('normalized', []) + query.get('redirects', [])}
    pages = {page['title']: page for page in query.get('pages', [])}
    files: dict[str, CommonsFile | None] = {}
    for name in requested:
        title = f'File:{name}'
        seen = {title}
        while title in renamed and renamed[title] not in seen:
            title = renamed[title]
            seen.add(title)
        page = pages.get(title)
        files[name] = _file(page) if page and page.get('imageinfo') else None
    return files


def _file(page: dict[str, Any]) -> CommonsFile:
    info = page['imageinfo'][0]
    # A file without metadata gets an empty list rather than an empty object.
    metadata = info.get('extmetadata') or {}
    license = metadata.get('License', {}).get('value', '')
    return CommonsFile(
        name=page['title'].removeprefix('File:'),
        license=license.lower(),
        mime=info['mime'],
        width=info['width'],
        height=info['height'],
        # The thumbnail link carries analytics parameters, which the file doesn't need.
        thumbnail=info.get('thumburl', info['url']).split('?')[0],
    )


class CommonsFiles:
    """
    Looks up image files on Wikimedia Commons: their size, type, license and thumbnail link,
    LOOKUP_BATCH files per request.

    Gateway: the rest of the fetch step knows nothing of the MediaWiki API.
    """

    def __init__(self, client: HttpClient, sleep: Callable[[float], None] = time.sleep) -> None:
        self._client = client
        self._sleep = sleep

    def describe(self, names: Sequence[str]) -> dict[str, CommonsFile | None]:
        files: dict[str, CommonsFile | None] = {}
        for batch in batched(names, LOOKUP_BATCH):
            files.update(self._describe_batch(batch))
        return files

    def _describe_batch(self, names: Sequence[str]) -> dict[str, CommonsFile | None]:
        form = {
            'action': 'query',
            'format': 'json',
            'formatversion': '2',
            'redirects': '1',
            'prop': 'imageinfo',
            'iiprop': 'url|size|mime|extmetadata',
            'iiextmetadatafilter': 'License',
            'iiurlwidth': str(DOWNLOAD_WIDTH),
            'maxlag': str(MAX_LAG_SECONDS),
            'titles': '|'.join(f'File:{name}' for name in names),
        }
        for _ in range(MAX_LAG_ATTEMPTS):
            response = json.loads(self._client.post(COMMONS_API, form))
            error = response.get('error')
            if error is None:
                return files_from_response(response, names)
            if error.get('code') != 'maxlag':
                raise RuntimeError(f"Commons API error: {error.get('code')}: {error.get('info')}")
            self._sleep(MAX_LAG_SECONDS)
        raise RuntimeError(f'Commons API stayed lagged after {MAX_LAG_ATTEMPTS} attempts')
