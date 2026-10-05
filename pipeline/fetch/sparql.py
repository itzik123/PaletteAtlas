import csv
import io
from typing import Protocol

from polite_client import HttpClient


class SparqlSelect(Protocol):
    """Anything that answers a SPARQL SELECT query with its rows."""

    def select(self, query: str) -> list[dict[str, str]]: ...


class SparqlEndpoint:
    """
    A SPARQL endpoint, asked for its answers in the SPARQL 1.1 CSV format: one row per solution,
    every value as plain text (IRIs in full, literals without quotes or language tags).
    """

    def __init__(self, client: HttpClient, url: str) -> None:
        self._client = client
        self._url = url

    def select(self, query: str) -> list[dict[str, str]]:
        body = self._client.post(self._url, {'query': query}, accept='text/csv')
        return list(csv.DictReader(io.StringIO(body.decode('utf-8'), newline='')))
