import { describe, expect, it } from 'vitest';
import { fileName } from './name-filing.ts';

/** Where a name is filed: its letter, and the words of it the list sets in bold. */
function filed(name: string): [letter: string, family: string] {
  const { letter, parts } = fileName(name);
  return [letter, parts.family];
}

describe('fileName', () => {
  it('files a painter under their family name, as museums index painters, its particles aside', () => {
    expect(filed('Claude Monet')).toEqual(['M', 'Monet']);
    expect(filed('Pierre-Auguste Renoir')).toEqual(['R', 'Renoir']);
    expect(filed('Vincent van Gogh')).toEqual(['G', 'Gogh']);
    expect(filed('Rogier van der Weyden')).toEqual(['W', 'Weyden']);
    expect(filed('Henri de Toulouse-Lautrec')).toEqual(['T', 'Toulouse-Lautrec']);
    expect(filed('Jacopo de’ Barbari')).toEqual(['B', 'Barbari']);
    expect(filed("Melchior d'Hondecoeter")).toEqual(['H', "d'Hondecoeter"]);
  });

  it('keeps a capitalized article or a Spanish second surname with the family name', () => {
    expect(filed('Georges de La Tour')).toEqual(['L', 'La Tour']);
    expect(filed('Charles Le Brun')).toEqual(['L', 'Le Brun']);
    expect(filed('Francisco Pradilla y Ortiz')).toEqual(['P', 'Pradilla y Ortiz']);
  });

  it('files an Italian given name with a place or a father’s name, a single name and a master under themselves', () => {
    expect(filed('Leonardo da Vinci')).toEqual(['L', 'Leonardo']);
    expect(filed('Piero della Francesca')).toEqual(['P', 'Piero']);
    expect(filed('Rembrandt')).toEqual(['R', 'Rembrandt']);
    expect(filed('Master of the Housebook')).toEqual(['M', 'Master of the Housebook']);
  });

  it('files by the name itself, not what follows it: an epithet, a generation or a title', () => {
    expect(filed('Pieter Brueghel the Elder')).toEqual(['B', 'Brueghel']);
    expect(filed('Gillis van Coninxloo (III)')).toEqual(['C', 'Coninxloo']);
    expect(filed('Abraham Janssens I')).toEqual(['J', 'Janssens']);
    expect(filed('John Frederick Herring, Sr.')).toEqual(['H', 'Herring']);
    expect(filed('Dorothy Boyle, Countess of Burlington and Countess of Cork')).toEqual(['B', 'Boyle']);
  });

  it('files a name in another script under #', () => {
    expect(filed('Головачевский, Александр Кириллович')).toEqual(['#', 'Головачевский']);
  });

  it('splits the name as written, for the list to set its family name in bold', () => {
    expect(fileName('Pieter Brueghel the Elder').parts).toEqual({ before: 'Pieter ', family: 'Brueghel', after: ' the Elder' });
    expect(fileName('Leonardo da Vinci').parts).toEqual({ before: '', family: 'Leonardo', after: ' da Vinci' });
  });

  it('orders names by family name, then given names, whatever their accents', () => {
    const names = ['Claude Monet', 'Berthe Morisot', 'Édouard Manet', 'Francisco Goya', 'Vincent van Gogh', 'Gwen John', 'Augustus John'];
    const sorted = names.toSorted((a, b) => (fileName(a).key < fileName(b).key ? -1 : 1));
    expect(sorted).toEqual(['Vincent van Gogh', 'Francisco Goya', 'Augustus John', 'Gwen John', 'Édouard Manet', 'Claude Monet', 'Berthe Morisot']);
  });
});
