import { describe, expect, it } from 'vitest';
import { CommonsImage } from './commons-image.ts';

// Reference links: the 500 px images the Commons API gave the fetch step for these files.

const MONA_LISA = new CommonsImage('Mona Lisa, by Leonardo da Vinci, from C2RMF retouched.jpg', 'ec', 7479);
const MONA_LISA_500 =
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/500px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg';

describe('CommonsImage', () => {
  it('links a thumbnail as Commons names it, escaping the file name as MediaWiki does', () => {
    expect(MONA_LISA.url(500)).toBe(MONA_LISA_500);
    const roslin = new CommonsImage("The Lady with the Veil (the Artist's Wife) (Alexander Roslin) - Nationalmuseum - 21152.tif", 'c8', 2966);
    const gauguin = new CommonsImage(
      'Paul Gauguin - Manaò tupapaú (Spirit of the Dead Watching) - 1965-1 - Albright–Knox Art Gallery.tiff',
      'fe',
      3392,
    );
    // A TIFF's thumbnails are JPEGs of its first page.
    expect(roslin.url(500)).toBe(
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c8/The_Lady_with_the_Veil_%28the_Artist%27s_Wife%29_%28Alexander_Roslin%29_-_Nationalmuseum_-_21152.tif/lossy-page1-500px-The_Lady_with_the_Veil_%28the_Artist%27s_Wife%29_%28Alexander_Roslin%29_-_Nationalmuseum_-_21152.tif.jpg',
    );
    expect(gauguin.url(500)).toBe(
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fe/Paul_Gauguin_-_Mana%C3%B2_tupapa%C3%BA_%28Spirit_of_the_Dead_Watching%29_-_1965-1_-_Albright%E2%80%93Knox_Art_Gallery.tiff/lossy-page1-500px-Paul_Gauguin_-_Mana%C3%B2_tupapa%C3%BA_%28Spirit_of_the_Dead_Watching%29_-_1965-1_-_Albright%E2%80%93Knox_Art_Gallery.tiff.jpg',
    );
  });

  it('names the thumbnails of a file whose name is over 160 bytes long "thumbnail"', () => {
    const cole = new CommonsImage(
      'The Cross and the World - The Pilgrim of the World on his Journey, study by Thomas Cole, c. 1846-1847, oil on canvas - Albany Institute of History and Art - DSC08125.JPG',
      '87',
      3788,
    );
    expect(cole.url(500)).toBe(
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/The_Cross_and_the_World_-_The_Pilgrim_of_the_World_on_his_Journey%2C_study_by_Thomas_Cole%2C_c._1846-1847%2C_oil_on_canvas_-_Albany_Institute_of_History_and_Art_-_DSC08125.JPG/500px-thumbnail.jpg',
    );
  });

  it('links the file itself when it is no wider than the width asked for', () => {
    const mantegna = new CommonsImage('Mantegna, madonna butler.jpg', '62', 500);
    expect(mantegna.url(500)).toBe('https://upload.wikimedia.org/wikipedia/commons/6/62/Mantegna%2C_madonna_butler.jpg');
    expect(mantegna.url(960)).toBe(mantegna.url(500));
    expect(mantegna.url(330)).toBe('https://thumb.wikimedia.org/wikipedia/commons/thumb/6/62/Mantegna%2C_madonna_butler.jpg/330px-Mantegna%2C_madonna_butler.jpg');
  });

  it('links the smallest standard width at least as wide as asked, the only widths Wikimedia serves to other sites', () => {
    expect(MONA_LISA.urlAtLeast(400)).toBe(MONA_LISA.url(500));
    expect(MONA_LISA.urlAtLeast(330)).toBe(MONA_LISA.url(330));
    expect(MONA_LISA.urlAtLeast(9000)).toBe(MONA_LISA.url(3840));
  });

  it('reads the file’s hash directory from a link to it or to a thumbnail', () => {
    expect(CommonsImage.hashIn(MONA_LISA_500)).toBe('ec');
    expect(CommonsImage.hashIn('https://upload.wikimedia.org/wikipedia/commons/6/62/Mantegna%2C_madonna_butler.jpg')).toBe('62');
    expect(CommonsImage.hashIn('https://example.org/elsewhere.jpg')).toBeUndefined();
  });

  it('links the file’s page on Commons', () => {
    expect(MONA_LISA.page).toBe('https://commons.wikimedia.org/wiki/File:Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg');
  });
});
