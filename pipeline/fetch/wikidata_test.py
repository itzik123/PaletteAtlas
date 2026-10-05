import unittest
from urllib.parse import quote

from wikidata import Candidate, WikidataCatalog, candidates_from_rows, rank

ENTITY = 'http://www.wikidata.org/entity/'
FILE_PATH = 'http://commons.wikimedia.org/wiki/Special:FilePath/'
DIED_BEFORE = 1956


def row(painting: str, *, artist: str = 'Q1', died: str = '1890-07-29T00:00:00Z', image: str = 'A.jpg',
        date: str = '1889-01-01T00:00:00Z', precision: str = '9', earliest: str = '', latest: str = '',
        sitelinks: str = '0') -> dict[str, str]:
    """A row as the paintings query answers it, in the SPARQL CSV format."""
    return {
        'painting': ENTITY + painting,
        'image': FILE_PATH + quote(image),
        'artist': artist if artist.startswith('http') else ENTITY + artist,
        'died': died,
        'date': date,
        'precision': precision,
        'earliest': earliest,
        'latest': latest,
        'sitelinks': sitelinks,
    }


def candidate(id: str, sitelinks: int = 0, file: str = 'A.jpg') -> Candidate:
    return Candidate(id=id, artist='Q1', artist_died=1890, year=1889, precision='year', file=file, sitelinks=sitelinks)


class CandidatesFromRowsTest(unittest.TestCase):
    def test_gives_one_candidate_per_painting_with_its_first_image_and_most_precise_date(self) -> None:
        rows = [
            row('Q10', image='Starry b.jpg', date='1601-01-01T00:00:00Z', precision='6', sitelinks='76'),
            row('Q10', image='Starry a.jpg', date='1890-01-01T00:00:00Z', precision='9', sitelinks='76'),
            row('Q10', image='Starry b.jpg', date='1889-06-01T00:00:00Z', precision='11', sitelinks='76'),
            row('Q10', image='Starry b.jpg', date='1889-01-01T00:00:00Z', precision='8', sitelinks='76'),
        ]
        self.assertEqual(
            candidates_from_rows(rows, DIED_BEFORE),
            [Candidate(id='Q10', artist='Q1', artist_died=1890, year=1889, precision='year', file='Starry a.jpg', sitelinks=76)],
        )

    def test_leaves_out_paintings_with_several_artists_or_one_unknown_or_still_under_copyright(self) -> None:
        rows = [
            row('Q10', artist='Q1'),
            row('Q10', artist='Q2'),
            row('Q11', artist='Q3', died='1960-03-01T00:00:00Z'),
            row('Q12', artist='Q4', died=''),
            row('Q13', artist='http://www.wikidata.org/.well-known/genid/8f2c'),
            row('Q14', artist='Q5', died='1955-12-31T00:00:00Z'),
        ]
        self.assertEqual([painting.id for painting in candidates_from_rows(rows, DIED_BEFORE)], ['Q14'])

    def test_reads_dates_before_the_common_era_and_names_their_precision(self) -> None:
        rows = [
            row('Q10', date='-0592-01-01T00:00:00Z', precision='7'),
            row('Q11', precision='8'),
            row('Q12', precision='6'),
            row('Q13', precision='3'),
        ]
        self.assertEqual(
            [(painting.id, painting.year, painting.precision) for painting in candidates_from_rows(rows, DIED_BEFORE)],
            [('Q10', -592, 'century'), ('Q11', 1889, 'decade'), ('Q12', 1889, 'millennium')],
        )

    def test_dates_a_painting_by_the_middle_year_of_its_range_as_precisely_as_the_range_allows(self) -> None:
        # Museum imports often record a range as a vague date with earliest and latest qualifiers.
        rows = [
            row('Q10', date='1601-01-01T00:00:00Z', precision='6', earliest='1591-01-01T00:00:00Z', latest='1612-01-01T00:00:00Z'),
            row('Q11', date='1644-01-01T00:00:00Z', precision='7', earliest='1616-01-01T00:00:00Z', latest='1673-01-01T00:00:00Z'),
            row('Q12', date='1650-01-01T00:00:00Z', precision='7', earliest='1650-01-01T00:00:00Z', latest='1651-01-01T00:00:00Z'),
        ]
        self.assertEqual(
            [(painting.id, painting.year, painting.precision) for painting in candidates_from_rows(rows, DIED_BEFORE)],
            [('Q10', 1601, 'decade'), ('Q11', 1644, 'century'), ('Q12', 1650, 'year')],
        )


class RankTest(unittest.TestCase):
    def test_puts_the_most_famous_first_and_draws_the_rest_by_the_seed_alone(self) -> None:
        candidates = [candidate(f'Q{number}', sitelinks) for number, sitelinks in enumerate([0, 3, 0, 0, 12, 0, 1, 0])]
        ranked = rank(candidates, seed=1)
        self.assertEqual([painting.sitelinks for painting in ranked[:3]], [12, 3, 1])
        self.assertEqual(rank(list(reversed(candidates)), seed=1), ranked)
        self.assertNotEqual(rank(candidates, seed=2)[3:], ranked[3:])


class FakeEndpoint:
    """Answers each query with the next set of rows, and remembers the queries."""

    def __init__(self, answers: list[list[dict[str, str]]]) -> None:
        self.answers = answers
        self.queries: list[str] = []

    def select(self, query: str) -> list[dict[str, str]]:
        self.queries.append(query)
        return self.answers.pop(0)


class LabelsTest(unittest.TestCase):
    def test_asks_in_batches_and_takes_each_item_s_label_in_the_first_language_on_the_list(self) -> None:
        endpoint = FakeEndpoint([
            [
                {'item': ENTITY + 'Q1', 'label': 'Sternennacht', 'lang': 'de'},
                {'item': ENTITY + 'Q1', 'label': 'The Starry Night', 'lang': 'en'},
                {'item': ENTITY + 'Q2', 'label': 'Het Joodse bruidje', 'lang': 'nl'},
                {'item': ENTITY + 'Q2', 'label': 'La Fiancée juive', 'lang': 'fr'},
            ],
            [{'item': ENTITY + 'Q3', 'label': 'Mona Lisa', 'lang': 'mul'}],
        ])
        labels = WikidataCatalog(endpoint, batch_size=2).labels(['Q1', 'Q2', 'Q3'])
        self.assertEqual(labels, {'Q1': 'The Starry Night', 'Q2': 'La Fiancée juive', 'Q3': 'Mona Lisa'})
        self.assertEqual(len(endpoint.queries), 2)
        self.assertIn('wd:Q3', endpoint.queries[1])


if __name__ == '__main__':
    unittest.main()
