import json
import unittest
from collections.abc import Sequence
from pathlib import Path
from tempfile import TemporaryDirectory

from catalog import Catalog, CatalogCompiler
from commons import CommonsFile
from wikidata import Candidate

#: The catalog the build's tests read (pipeline/build/src/painting-data.test.ts), written by this step.
BUILD_FIXTURE = Path(__file__).resolve().parents[1] / 'fixtures' / 'wikidata' / 'works.json'


class FakeWikidata:
    """Wikidata's side of the catalog, with every name made up from the item's id."""

    def __init__(self, candidates: list[Candidate]) -> None:
        self._candidates = candidates

    def paintings(self, died_before: int) -> list[Candidate]:
        return self._candidates

    def labels(self, ids: Sequence[str]) -> dict[str, str]:
        return {id: f'Name of {id}' for id in ids}

    def collections(self, ids: Sequence[str]) -> dict[str, str]:
        return {id: 'Q190804' for id in ids}

    def birth_years(self, ids: Sequence[str]) -> dict[str, int]:
        return {id: 1606 for id in ids}


class FakeCommons:
    """Commons' side: every file public domain, except those whose names say their photo claims a license."""

    def __init__(self) -> None:
        self.asked: list[str] = []

    def describe(self, names: Sequence[str]) -> dict[str, CommonsFile | None]:
        self.asked.extend(names)
        return {
            name: CommonsFile(
                name=name,
                license='cc-by-sa-4.0' if name.startswith('claimed') else 'pd',
                mime='image/jpeg',
                width=2000,
                height=1500,
                thumbnail=f'https://upload.example/500px-{name}',
            )
            for name in names
        }


def candidate(id: str, sitelinks: int, file: str) -> Candidate:
    return Candidate(id=id, artist='Q5598', artist_died=1669, year=1642, precision='year', file=file, sitelinks=sitelinks)


class CatalogCompilerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.commons = FakeCommons()
        candidates = [
            candidate('Q1', 9, 'claimed.jpg'),
            candidate('Q2', 8, 'B.jpg'),
            candidate('Q3', 7, 'B.jpg'),
            candidate('Q4', 6, 'D.jpg'),
            candidate('Q5', 5, 'E.jpg'),
        ]
        compiler = CatalogCompiler(FakeWikidata(candidates), self.commons, count=2, seed=1, log=lambda _: None)
        self.catalog = compiler.compile(died_before=1956, created='2026-10-05')

    def test_takes_the_most_famous_usable_paintings_each_with_its_own_image_up_to_the_count(self) -> None:
        # Q1's photo claims a license of its own, and Q3 shares Q2's image.
        self.assertEqual([work.id for work in self.catalog.works], ['Q2', 'Q4'])
        self.assertEqual(self.catalog.works[0].image, 'images/Q2.jpg')
        self.assertEqual(self.catalog.works[0].title, 'Name of Q2')
        self.assertEqual(self.catalog.works[0].collection, 'Name of Q190804')
        self.assertEqual(set(self.catalog.artists), {'Q5598'})
        self.assertEqual(self.catalog.artists['Q5598'].name, 'Name of Q5598')

    def test_saves_a_catalog_that_reads_back_the_same(self) -> None:
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'works.json'
            self.catalog.save(path)
            self.assertEqual(Catalog.load(path), self.catalog)

    def test_writes_the_fields_the_build_s_tests_read(self) -> None:
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'works.json'
            self.catalog.save(path)
            saved = json.loads(path.read_text(encoding='utf-8'))
        fixture = json.loads(BUILD_FIXTURE.read_text(encoding='utf-8'))
        self.assertEqual(saved.keys(), fixture.keys())
        self.assertEqual(saved['works'][0].keys(), fixture['works'][0].keys())
        self.assertEqual(next(iter(saved['artists'].values())).keys(), next(iter(fixture['artists'].values())).keys())


if __name__ == '__main__':
    unittest.main()
