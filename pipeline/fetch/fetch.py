"""
Fetches the paintings the Atlas shows, in two steps that write to pipeline/data/wikidata:

  python pipeline/fetch/fetch.py catalog   chooses the paintings and writes works.json (about 30 minutes)
  python pipeline/fetch/fetch.py images    downloads their images into images/ (hours; rerun to resume)

The catalog comes from Wikidata through QLever, and each painting's image file from Wikimedia
Commons, which says whether the file is free to use. Rerun both before a release to pick up
Wikidata's changes; the images step downloads only what is new.
"""

import argparse
import platform
import sys
from datetime import date
from pathlib import Path

from catalog import Catalog, CatalogCompiler
from commons import CommonsFiles
from download import ImageDownloader, ImageFile
from polite_client import PoliteClient
from sparql import SparqlEndpoint
from wikidata import WikidataCatalog

DATA_FOLDER = Path(__file__).resolve().parents[1] / 'data' / 'wikidata'
CATALOG_FILE = 'works.json'
#: QLever answers SPARQL over a copy of Wikidata, refreshed every few days. Wikidata's own query
#: service gives up after 60 seconds, too soon for a query over every painting.
QLEVER_WIKIDATA = 'https://qlever.dev/api/wikidata'
#: Names the project and how to reach it, as Wikimedia's User-Agent policy asks.
USER_AGENT = f'PaletteAtlas/0.1 (https://palette-atlas.pages.dev) Python-urllib/{platform.python_version()}'
#: The pause between the starts of two requests; requests also never overlap.
REQUEST_INTERVAL_SECONDS = 0.5
#: A painting qualifies when its artist died this many years ago or more (Commons then checks
#: each file's own status).
PUBLIC_DOMAIN_YEARS = 70
#: How many paintings the catalog holds.
COLLECTION_SIZE = 50_000
#: Draws the paintings that no Wikipedia writes about; a fixed seed gives the same draw each run.
DRAW_SEED = 1


def compile_catalog(count: int, seed: int) -> None:
    client = PoliteClient(USER_AGENT, REQUEST_INTERVAL_SECONDS)
    wikidata = WikidataCatalog(SparqlEndpoint(client, QLEVER_WIKIDATA))
    compiler = CatalogCompiler(wikidata, CommonsFiles(client), count, seed)
    today = date.today()
    catalog = compiler.compile(died_before=today.year - PUBLIC_DOMAIN_YEARS, created=today.isoformat())
    catalog.save(DATA_FOLDER / CATALOG_FILE)
    print(f'Wrote {len(catalog.works):,} paintings by {len(catalog.artists):,} artists to {DATA_FOLDER / CATALOG_FILE}')


def download_images() -> None:
    catalog = Catalog.load(DATA_FOLDER / CATALOG_FILE)
    downloader = ImageDownloader(PoliteClient(USER_AGENT, REQUEST_INTERVAL_SECONDS), DATA_FOLDER)
    report = downloader.download([ImageFile(work.thumbnail, work.image) for work in catalog.works])
    print(f'Downloaded {report.downloaded:,}, already there {report.skipped:,}, failed {len(report.failed):,}')


def main() -> None:
    # Titles and names go beyond the Windows console's code page.
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    steps = parser.add_subparsers(dest='step', required=True)
    catalog = steps.add_parser('catalog', help='choose the paintings and write works.json')
    catalog.add_argument('--count', type=int, default=COLLECTION_SIZE, help='how many paintings to choose')
    catalog.add_argument('--seed', type=int, default=DRAW_SEED, help='seed of the draw among paintings no Wikipedia covers')
    steps.add_parser('images', help='download the images of the paintings in works.json')
    arguments = parser.parse_args()
    if arguments.step == 'catalog':
        compile_catalog(arguments.count, arguments.seed)
    else:
        download_images()


if __name__ == '__main__':
    main()
