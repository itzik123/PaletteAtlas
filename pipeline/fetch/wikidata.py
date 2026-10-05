import hashlib
import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from itertools import batched
from string import Template
from urllib.parse import unquote

from sparql import SparqlSelect

ENTITY_PREFIX = 'http://www.wikidata.org/entity/'
FILE_PATH_PREFIX = 'http://commons.wikimedia.org/wiki/Special:FilePath/'
#: Wikidata's date precisions, by the names the catalog gives them. Finer ones (a month, a day)
#: count as a year; coarser ones than a millennium leave a painting undated.
PRECISIONS = {6: 'millennium', 7: 'century', 8: 'decade', 9: 'year'}
YEAR_PRECISION = 9
#: The precision a date range allows: the longest span of years that still counts as a year, a
#: decade or a century, about ±1, ±12 and ±75 years around its middle.
RANGE_PRECISIONS = ((2, 9), (25, 8), (150, 7))
#: The languages a title or name is taken in, in order of preference: English first, then
#: Wikidata's language-neutral labels, then the languages of the most paintings without either.
LABEL_LANGUAGES = (
    'en', 'mul', 'de', 'fr', 'nl', 'es', 'pt', 'it', 'et', 'sk', 'pl', 'fi', 'sv', 'da', 'nb', 'cs', 'hu', 'ca', 'ru', 'ja', 'zh',
)
#: Items per query when asking about many at once.
QUERY_BATCH = 5000

PREFIXES = """
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
PREFIX psv: <http://www.wikidata.org/prop/statement/value/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
"""

# Every painting with an image, an artist, a date and a collection: one row per combination of
# its images, artists and dates. Artists are not filtered here, so that a painting's second
# artist still shows up even when only the first has a date of death. A date may come with the
# earliest and latest years of a range.
PAINTINGS_QUERY = PREFIXES + """
SELECT DISTINCT ?painting ?image ?artist ?died ?date ?precision ?earliest ?latest ?sitelinks WHERE {
  ?painting wdt:P31 wd:Q3305213 ;
            wdt:P18 ?image ;
            wdt:P170 ?artist ;
            p:P571 ?dated .
  ?dated psv:P571 ?inception .
  ?inception wikibase:timeValue ?date ;
             wikibase:timePrecision ?precision .
  FILTER EXISTS { ?painting wdt:P195 [] }
  OPTIONAL { ?dated pq:P1319 ?earliest }
  OPTIONAL { ?dated pq:P1326 ?latest }
  OPTIONAL { ?artist wdt:P570 ?died }
  OPTIONAL { ?painting wikibase:sitelinks ?sitelinks }
}
"""

LABELS_QUERY = Template(PREFIXES + """
SELECT ?item ?label ?lang WHERE {
  VALUES ?item { $items }
  ?item rdfs:label ?label .
  BIND(LANG(?label) AS ?lang)
  FILTER(?lang IN ($languages))
}
""")

# The collections that hold each painting now: statements with no end date, not deprecated.
COLLECTIONS_QUERY = Template(PREFIXES + """
SELECT ?item ?collection WHERE {
  VALUES ?item { $items }
  ?item p:P195 ?statement .
  ?statement ps:P195 ?collection .
  FILTER NOT EXISTS { ?statement wikibase:rank wikibase:DeprecatedRank }
  FILTER NOT EXISTS { ?statement pq:P582 [] }
}
""")

BIRTHS_QUERY = Template(PREFIXES + """
SELECT ?item ?born WHERE {
  VALUES ?item { $items }
  ?item wdt:P569 ?born .
}
""")


@dataclass(frozen=True, slots=True)
class Candidate:
    """A painting that may go into the collection, as Wikidata describes it."""

    #: Its Wikidata item, e.g. Q45585.
    id: str
    #: Its one artist's Wikidata item.
    artist: str
    #: The year its artist died.
    artist_died: int
    #: The year it was made, as precise as `precision` says.
    year: int
    precision: str
    #: Its image's file name on Wikimedia Commons.
    file: str
    #: In how many Wikimedia projects (mostly Wikipedias) it has an article: how famous it is.
    sitelinks: int


@dataclass
class _PaintingRows:
    """What the rows about one painting say, gathered."""

    files: set[str] = field(default_factory=set)
    #: Each artist (by IRI, so an unknown artist counts too), with the latest year they died.
    artists: dict[str, int | None] = field(default_factory=dict)
    #: (year, precision) pairs.
    dates: set[tuple[int, int]] = field(default_factory=set)
    sitelinks: int = 0


def candidates_from_rows(rows: Iterable[dict[str, str]], died_before: int) -> list[Candidate]:
    """
    One candidate per painting from the paintings query's rows: its first image by name, its
    most precise date, and its one artist, who died before the year `died_before`. Paintings with
    several artists, an unknown one, one still under copyright, or no usable date are left out.
    """
    paintings: dict[str, _PaintingRows] = {}
    for row in rows:
        id = _entity_id(row['painting'])
        if id is None:
            continue
        painting = paintings.setdefault(id, _PaintingRows())
        painting.files.add(unquote(row['image'].removeprefix(FILE_PATH_PREFIX)))
        died, known = _year(row['died']), painting.artists.get(row['artist'])
        if known is None or (died is not None and died > known):
            painting.artists[row['artist']] = died
        date = _date(row)
        if date is not None:
            painting.dates.add(date)
        painting.sitelinks = max(painting.sitelinks, int(row['sitelinks'] or 0))
    candidates = (_candidate(id, painting, died_before) for id, painting in paintings.items())
    return [candidate for candidate in candidates if candidate is not None]


def _candidate(id: str, painting: _PaintingRows, died_before: int) -> Candidate | None:
    if len(painting.artists) != 1:
        return None
    [(artist_iri, died)] = painting.artists.items()
    artist = _entity_id(artist_iri)
    if artist is None or died is None or died >= died_before:
        return None
    # The most precise date, and of those the earliest: "1889" over "19th century", even though
    # Wikidata may record the century as an earlier year.
    dates = [(year, precision) for year, precision in painting.dates if precision >= min(PRECISIONS)]
    if not dates:
        return None
    year, precision = min(dates, key=lambda date: (-date[1], date[0]))
    return Candidate(
        id=id,
        artist=artist,
        artist_died=died,
        year=year,
        precision=PRECISIONS[precision],
        file=min(painting.files),
        sitelinks=painting.sitelinks,
    )


def _date(row: dict[str, str]) -> tuple[int, int] | None:
    """
    A row's date as (year, precision), finer than a year counting as a year. A date given as a
    range (often recorded as a vague date with earliest and latest qualifiers) is as precise as
    its span allows, and falls in its middle year, rounded down.
    """
    year = _year(row['date'])
    if year is None:
        return None
    precision = min(int(row['precision']), YEAR_PRECISION)
    earliest, latest = _year(row.get('earliest', '')), _year(row.get('latest', ''))
    if earliest is not None and latest is not None and latest >= earliest:
        span = next((level for longest, level in RANGE_PRECISIONS if latest - earliest <= longest), None)
        if span is not None and span > precision:
            return (earliest + latest) // 2, span
    return year, precision


def rank(candidates: Iterable[Candidate], seed: int) -> list[Candidate]:
    """
    The candidates, the most famous first (by sitelinks), the rest in a draw by the seed: an
    order that depends on the seed alone, never on the order the query answered in.
    """
    return sorted(candidates, key=lambda candidate: (-candidate.sitelinks, _draw(seed, candidate.id)))


def _draw(seed: int, id: str) -> bytes:
    return hashlib.sha256(f'{seed}:{id}'.encode()).digest()


class WikidataCatalog:
    """
    Wikidata's paintings, and the titles, names, collections and birth years the catalog shows,
    asked over SPARQL; the details come in batches of items.

    Gateway: the rest of the fetch step knows nothing of SPARQL or of Wikidata's data model.
    """

    def __init__(self, endpoint: SparqlSelect, batch_size: int = QUERY_BATCH) -> None:
        self._endpoint = endpoint
        self._batch_size = batch_size

    def paintings(self, died_before: int) -> list[Candidate]:
        return candidates_from_rows(self._endpoint.select(PAINTINGS_QUERY), died_before)

    def labels(self, ids: Sequence[str]) -> dict[str, str]:
        """Each item's label in the first language of LABEL_LANGUAGES it has one in."""
        languages = ', '.join(f'"{language}"' for language in LABEL_LANGUAGES)
        preference = {language: index for index, language in enumerate(LABEL_LANGUAGES)}
        best: dict[str, tuple[int, str]] = {}
        for row in self._select_batches(LABELS_QUERY, ids, languages=languages):
            id, choice = _entity_id(row['item']), (preference[row['lang']], row['label'])
            if id is not None and (id not in best or choice < best[id]):
                best[id] = choice
        return {id: label for id, (_, label) in best.items()}

    def collections(self, ids: Sequence[str]) -> dict[str, str]:
        """
        The collection that holds each painting now. Of several, the oldest Wikidata item (the
        lowest number), which is mostly the museum rather than one of its departments.
        """
        held: dict[str, str] = {}
        for row in self._select_batches(COLLECTIONS_QUERY, ids):
            id, collection = _entity_id(row['item']), _entity_id(row['collection'])
            if id is None or collection is None:
                continue
            if id not in held or _number(collection) < _number(held[id]):
                held[id] = collection
        return held

    def birth_years(self, ids: Sequence[str]) -> dict[str, int]:
        """Each person's earliest recorded year of birth."""
        born: dict[str, int] = {}
        for row in self._select_batches(BIRTHS_QUERY, ids):
            id, year = _entity_id(row['item']), _year(row['born'])
            if id is not None and year is not None:
                born[id] = min(year, born.get(id, year))
        return born

    def _select_batches(self, query: Template, ids: Sequence[str], **values: str) -> Iterable[dict[str, str]]:
        for batch in batched(ids, self._batch_size):
            items = ' '.join(f'wd:{id}' for id in batch)
            yield from self._endpoint.select(query.substitute(items=items, **values))


def _entity_id(iri: str) -> str | None:
    """The item id in a Wikidata entity IRI, or None for anything else (such as an unknown value)."""
    return iri.removeprefix(ENTITY_PREFIX) if iri.startswith(ENTITY_PREFIX) else None


def _number(id: str) -> int:
    return int(id.removeprefix('Q'))


_YEAR = re.compile(r'^(-?\d+)-\d\d-\d\dT')


def _year(date_time: str) -> int | None:
    """The year of an xsd:dateTime such as 1889-06-01T00:00:00Z or -0592-01-01T00:00:00Z."""
    match = _YEAR.match(date_time)
    return int(match.group(1)) if match else None
