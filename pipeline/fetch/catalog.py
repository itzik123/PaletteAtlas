import json
from collections import Counter
from collections.abc import Callable, Sequence
from dataclasses import asdict, dataclass
from itertools import batched
from pathlib import Path
from typing import Protocol

from commons import FREE_LICENSES, LOOKUP_BATCH, CommonsFile, is_usable
from wikidata import Candidate, rank

#: Where the catalog's facts come from, as the catalog file credits them.
SOURCE = 'Wikidata (queried through QLever) and Wikimedia Commons'
#: The folder, inside the data folder, that holds the downloaded images.
IMAGES_FOLDER = 'images'
#: How often the compiler reports its progress through the license checks, in files.
PROGRESS_EVERY = 5000


@dataclass(frozen=True, slots=True)
class Work:
    """A painting in the catalog: the contract between the fetch step and the build."""

    #: Its Wikidata item, e.g. Q45585.
    id: str
    #: Its title in the first language of wikidata.LABEL_LANGUAGES it has one in, if any.
    title: str | None
    #: Its artist's Wikidata item, a key of Catalog.artists.
    artist: str
    #: The year it was made, as precise as `precision` says: year, decade, century or millennium.
    year: int
    precision: str
    #: The museum or collection that holds it now, if Wikidata names it.
    collection: str | None
    #: In how many Wikimedia projects (mostly Wikipedias) it has an article.
    sitelinks: int
    #: Its image's file name on Wikimedia Commons, and the file's license there (`pd` or `cc0`).
    file: str
    license: str
    #: The full size of the image on Commons.
    width: int
    height: int
    #: Where its image is downloaded from, and its path in the data folder once downloaded.
    thumbnail: str
    image: str


@dataclass(frozen=True, slots=True)
class Artist:
    name: str | None
    born: int | None
    died: int


@dataclass(frozen=True, slots=True)
class Catalog:
    """The paintings chosen for download, and their artists; saved as works.json."""

    #: The day it was compiled, in ISO format.
    created: str
    works: list[Work]
    artists: dict[str, Artist]

    def save(self, path: Path) -> None:
        document = {
            'source': SOURCE,
            'created': self.created,
            'works': [asdict(work) for work in self.works],
            'artists': {id: asdict(artist) for id, artist in self.artists.items()},
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(document, ensure_ascii=False, indent=1), encoding='utf-8')

    @staticmethod
    def load(path: Path) -> 'Catalog':
        document = json.loads(path.read_text(encoding='utf-8'))
        return Catalog(
            created=document['created'],
            works=[Work(**work) for work in document['works']],
            artists={id: Artist(**artist) for id, artist in document['artists'].items()},
        )


class PaintingSource(Protocol):
    """Where candidate paintings and their details come from (Wikidata)."""

    def paintings(self, died_before: int) -> list[Candidate]: ...

    def labels(self, ids: Sequence[str]) -> dict[str, str]: ...

    def collections(self, ids: Sequence[str]) -> dict[str, str]: ...

    def birth_years(self, ids: Sequence[str]) -> dict[str, int]: ...


class FileRegistry(Protocol):
    """Where image files are described (Wikimedia Commons)."""

    def describe(self, names: Sequence[str]) -> dict[str, CommonsFile | None]: ...


class CatalogCompiler:
    """
    Chooses the paintings to download. It ranks the candidates (the most famous first, then a
    seeded draw) and walks down the ranking, keeping each painting whose image is usable (see
    commons.is_usable) and not already taken by another painting, until it has `count`. Then it
    looks up their titles, artists and collections.

    The two sources are injected as interfaces, so tests run on made-up paintings and files.
    """

    def __init__(
        self,
        paintings: PaintingSource,
        files: FileRegistry,
        count: int,
        seed: int,
        log: Callable[[str], None] = print,
    ) -> None:
        self._paintings = paintings
        self._files = files
        self._count = count
        self._seed = seed
        self._log = log

    def compile(self, died_before: int, created: str) -> Catalog:
        candidates = self._paintings.paintings(died_before)
        self._log(f'{len(candidates):,} candidate paintings on Wikidata')
        chosen = self._choose(rank(candidates, self._seed))
        return self._describe(chosen, created)

    def _choose(self, ranked: list[Candidate]) -> list[tuple[Candidate, CommonsFile]]:
        chosen: list[tuple[Candidate, CommonsFile]] = []
        taken: set[str] = set()
        refused: Counter[str] = Counter()
        checked = 0
        for batch in batched(ranked, LOOKUP_BATCH):
            files = self._files.describe([candidate.file for candidate in batch])
            for candidate in batch:
                checked += 1
                file = files.get(candidate.file)
                if file is None or not is_usable(file) or file.name in taken:
                    refused[_refusal(file)] += 1
                    continue
                taken.add(file.name)
                chosen.append((candidate, file))
                if len(chosen) == self._count:
                    break
            if len(chosen) == self._count:
                break
            if checked % PROGRESS_EVERY == 0:
                self._log(f'Checked {checked:,} files: {len(chosen):,} usable')
        self._log(f'Checked {checked:,} files: {len(chosen):,} usable; refused {dict(refused)}')
        if len(chosen) < self._count:
            self._log(f'Only {len(chosen):,} usable paintings of the {self._count:,} wanted')
        return chosen

    def _describe(self, chosen: list[tuple[Candidate, CommonsFile]], created: str) -> Catalog:
        work_ids = [candidate.id for candidate, _ in chosen]
        artist_ids = sorted({candidate.artist for candidate, _ in chosen})
        collections = self._paintings.collections(work_ids)
        labels = self._paintings.labels([*work_ids, *artist_ids, *sorted(set(collections.values()))])
        born = self._paintings.birth_years(artist_ids)
        died = {candidate.artist: candidate.artist_died for candidate, _ in chosen}
        works = [
            Work(
                id=candidate.id,
                title=labels.get(candidate.id),
                artist=candidate.artist,
                year=candidate.year,
                precision=candidate.precision,
                collection=labels.get(collections[candidate.id]) if candidate.id in collections else None,
                sitelinks=candidate.sitelinks,
                file=file.name,
                license=file.license,
                width=file.width,
                height=file.height,
                thumbnail=file.thumbnail,
                image=f'{IMAGES_FOLDER}/{candidate.id}{_extension(file.thumbnail)}',
            )
            for candidate, file in chosen
        ]
        artists = {id: Artist(name=labels.get(id), born=born.get(id), died=died[id]) for id in artist_ids}
        return Catalog(created=created, works=works, artists=artists)


def _refusal(file: CommonsFile | None) -> str:
    """Why a painting's file was refused, for the log."""
    if file is None:
        return 'missing'
    if file.license not in FREE_LICENSES:
        return 'license'
    if not is_usable(file):
        return 'type or size'
    return 'shared'


def _extension(url: str) -> str:
    """A downloaded image's file extension, from its link: Commons serves TIFF thumbnails as .jpg."""
    suffix = Path(url).suffix.lower()
    return '.jpg' if suffix == '.jpeg' else suffix
