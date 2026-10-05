import unittest
from dataclasses import replace

from commons import DOWNLOAD_WIDTH, CommonsFile, files_from_response, is_usable

THUMBNAIL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/A.jpg/500px-A.jpg'


def commons_file(**changes) -> CommonsFile:
    return replace(CommonsFile(name='A.jpg', license='pd', mime='image/jpeg', width=2000, height=1500, thumbnail=THUMBNAIL), **changes)


class IsUsableTest(unittest.TestCase):
    def test_keeps_only_public_domain_and_cc0_raster_images_wide_enough_to_download(self) -> None:
        self.assertTrue(is_usable(commons_file()))
        self.assertTrue(is_usable(commons_file(license='cc0')))
        for unusable in [
            commons_file(license='cc-by-sa-4.0'),
            commons_file(license=''),
            commons_file(mime='image/svg+xml'),
            commons_file(width=DOWNLOAD_WIDTH - 1),
        ]:
            self.assertFalse(is_usable(unusable), unusable)


class FilesFromResponseTest(unittest.TestCase):
    def test_follows_normalized_names_and_redirects_back_to_the_names_asked_for(self) -> None:
        response = {
            'query': {
                'normalized': [{'from': 'File:a_b.jpg', 'to': 'File:A b.jpg'}],
                'redirects': [{'from': 'File:A b.jpg', 'to': 'File:C.jpg'}],
                'pages': [
                    {
                        'title': 'File:C.jpg',
                        'imageinfo': [{
                            'width': 800,
                            'height': 600,
                            'mime': 'image/jpeg',
                            'url': 'https://upload.wikimedia.org/wikipedia/commons/c/cc/C.jpg',
                            'thumburl': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/C.jpg/500px-C.jpg?utm_source=commons',
                            'extmetadata': {'License': {'value': 'pd'}},
                        }],
                    },
                    {'title': 'File:Gone.jpg', 'missing': True},
                    {
                        'title': 'File:Bare.jpg',
                        # The API sends a file without metadata an empty list, not an empty object.
                        'imageinfo': [{
                            'width': 800,
                            'height': 600,
                            'mime': 'image/jpeg',
                            'url': 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Bare.jpg',
                            'extmetadata': [],
                        }],
                    },
                ],
            },
        }
        self.assertEqual(
            files_from_response(response, ['a_b.jpg', 'Gone.jpg', 'Bare.jpg']),
            {
                'a_b.jpg': CommonsFile(
                    name='C.jpg',
                    license='pd',
                    mime='image/jpeg',
                    width=800,
                    height=600,
                    thumbnail='https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/C.jpg/500px-C.jpg',
                ),
                'Gone.jpg': None,
                'Bare.jpg': CommonsFile(
                    name='Bare.jpg',
                    license='',
                    mime='image/jpeg',
                    width=800,
                    height=600,
                    thumbnail='https://upload.wikimedia.org/wikipedia/commons/b/bb/Bare.jpg',
                ),
            },
        )


if __name__ == '__main__':
    unittest.main()
