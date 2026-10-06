import { describe, expect, it } from 'vitest';
import { NameSearch } from './name-search.ts';

/** Painters as the list gives them, the most famous first. */
const PAINTERS = [
  'Leonardo da Vinci',
  'Vincent van Gogh',
  'Johannes Vermeer',
  'Rembrandt',
  'Claude Monet',
  'Édouard Manet',
  'Paul Cézanne',
  'Jan van Eyck',
  'Pierre-Auguste Renoir',
  'Francisco de Zurbarán',
  'Jan Steen',
  'Willem van de Velde the Younger',
  'Vincent Courdouan',
  'Jan van Goyen',
];

const search = new NameSearch(PAINTERS, (name) => name);

describe('NameSearch', () => {
  it('finds a painter by any of their names, in any order, whatever the accents or case', () => {
    expect(search.find('gogh')[0]).toBe('Vincent van Gogh');
    expect(search.find('GOGH Vincent')[0]).toBe('Vincent van Gogh');
    expect(search.find('cezanne')[0]).toBe('Paul Cézanne');
    expect(search.find('Zurbaran')[0]).toBe('Francisco de Zurbarán');
    expect(search.find('pierre auguste')[0]).toBe('Pierre-Auguste Renoir');
  });

  it('still finds a painter by a name the gallery leaves out, such as a middle name', () => {
    expect(search.find('Vincent Willem van Gogh')[0]).toBe('Vincent van Gogh');
    expect(search.find('Rembrandt Harmenszoon van Rijn')[0]).toBe('Rembrandt');
    expect(search.find('Jan Havickszoon Steen')[0]).toBe('Jan Steen');
  });

  it('forgives a slip or two in spelling, and words partly typed or run together', () => {
    expect(search.find('vermer')[0]).toBe('Johannes Vermeer');
    expect(search.find('rembrnt')[0]).toBe('Rembrandt');
    expect(search.find('Pierre Augste Renior')[0]).toBe('Pierre-Auguste Renoir');
    expect(search.find('remb')[0]).toBe('Rembrandt');
    expect(search.find('rembrnd')[0]).toBe('Rembrandt');
    expect(search.find('davinci')[0]).toBe('Leonardo da Vinci');
    expect(search.find('vangogh')[0]).toBe('Vincent van Gogh');
  });

  it('lists the closer match first, and the more famous among equal ones', () => {
    expect(search.find('monet').slice(0, 2)).toEqual(['Claude Monet', 'Édouard Manet']);
    expect(search.find('jan')).toEqual(['Jan van Eyck', 'Jan Steen', 'Jan van Goyen']);
    // A rare word counts for more than a common one: two painters here are named Vincent, four have a "van".
    expect(search.find('vincent van')).toEqual([
      'Vincent van Gogh',
      'Vincent Courdouan',
      'Jan van Eyck',
      'Willem van de Velde the Younger',
      'Jan van Goyen',
    ]);
  });

  it('leaves out every painter with no name like the search, and finds none for nothing', () => {
    expect(search.find('Picasso')).toEqual([]);
    expect(search.find('  ')).toEqual([]);
  });
});
