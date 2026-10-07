import { ByteReader, ByteWriter } from './byte-stream.ts';
import { LayeredGraph } from './layered-graph.ts';
import { QuantizedVectors } from './quantized-vectors.ts';
import type { Vectors } from './vectors.ts';

/** The file's first bytes, "HNSW", which tell it from anything else. */
const MAGIC = Uint8Array.from('HNSW', (letter) => letter.charCodeAt(0));
/** The layout below; a change to it gets a new version, and old files are refused rather than misread. */
const VERSION = 1;

/** An index as a file holds it: its graph, and its vectors as they come back from a byte each. */
export interface IndexContents {
  readonly graph: LayeredGraph;
  readonly vectors: Vectors;
}

/**
 * Writes an HNSW index into bytes, little-endian:
 *
 *   "HNSW", version            5 bytes
 *   count, dimensions          uint32 each
 *   M_max, M_max0              uint16 each: the most links per node above the bottom layer, and on it
 *   entry point                uint32 (0 in an empty index)
 *   top level                  uint8
 *   levels                     uint8 per node
 *   vectors                    each dimension's smallest, then largest value as float32, then a byte
 *                              per value (QuantizedVectors)
 *   links                      layer by layer from the bottom, node by node in id order, every node of
 *                              the layer: its number of links, then its links in ascending order as
 *                              the differences between them, all as variable-length integers
 *
 * Sorting each node's links leaves small differences, most of which take one or two bytes rather
 * than four: the paintings' 819,191 links take 1.65 MB instead of 3.48 (Oct 7, 2026). The order of
 * a node's links doesn't change what a search finds.
 */
export function writeIndex(graph: LayeredGraph, vectors: Vectors): Uint8Array {
  const writer = new ByteWriter();
  writer.bytes(MAGIC);
  writer.uint8(VERSION);
  writer.uint32(graph.count);
  writer.uint32(vectors.dimensions);
  writer.uint16(graph.maxNeighbors(1));
  writer.uint16(graph.maxNeighbors(0));
  writer.uint32(Math.max(graph.entryPoint, 0));
  writer.uint8(Math.max(graph.topLevel, 0));
  writer.bytes(Uint8Array.from({ length: graph.count }, (_, node) => graph.levelOf(node)));

  const quantized = QuantizedVectors.from(vectors);
  quantized.minimums.forEach((value) => writer.float32(value));
  quantized.maximums.forEach((value) => writer.float32(value));
  writer.bytes(quantized.levels);

  for (let level = 0; level <= graph.topLevel; level++) {
    for (let node = 0; node < graph.count; node++) {
      if (graph.levelOf(node) < level) continue;
      const links = graph.neighbors(node, level).sort((first, second) => first - second);
      writer.varint(links.length);
      links.forEach((link, index) => writer.varint(index === 0 ? link : link - links[index - 1]));
    }
  }
  return writer.toBytes();
}

/** Reads what writeIndex wrote, checking that it is whole and makes a graph; anything else throws. */
export function readIndex(bytes: Uint8Array): IndexContents {
  const reader = new ByteReader(bytes);
  const magic = reader.bytes(MAGIC.length);
  if (magic.some((byte, index) => byte !== MAGIC[index])) throw new Error('These bytes are not an HNSW index');
  const version = reader.uint8();
  if (version !== VERSION) throw new Error(`HNSW index version ${version} can't be read; this code reads version ${VERSION}`);
  const count = reader.uint32();
  const dimensions = reader.uint32();
  const maxNeighbors = reader.uint16();
  const maxNeighbors0 = reader.uint16();
  const entryPoint = reader.uint32();
  const topLevel = reader.uint8();
  const levels = reader.bytes(count).slice();

  const minimums = Float32Array.from({ length: dimensions }, () => reader.float32());
  const maximums = Float32Array.from({ length: dimensions }, () => reader.float32());
  const vectors = new QuantizedVectors(dimensions, minimums, maximums, reader.bytes(count * dimensions)).toVectors();

  const graph = new LayeredGraph(levels, maxNeighbors, maxNeighbors0);
  if (count > 0) {
    if (entryPoint >= count || levels[entryPoint] !== topLevel || levels.some((level) => level > topLevel)) {
      throw new RangeError(`The entry point ${entryPoint} is not a node on the top layer, ${topLevel}`);
    }
    graph.entryPoint = entryPoint;
    graph.topLevel = topLevel;
  }
  const links: number[] = [];
  for (let level = 0; level <= graph.topLevel; level++) {
    for (let node = 0; node < count; node++) {
      if (levels[node] < level) continue;
      const degree = reader.varint();
      if (degree > graph.maxNeighbors(level)) throw new RangeError(`Node ${node} has ${degree} links on layer ${level}, more than it can`);
      links.length = degree;
      for (let index = 0; index < links.length; index++) links[index] = reader.varint() + (index === 0 ? 0 : links[index - 1]);
      if (links.some((link) => link >= count || levels[link] < level)) throw new RangeError(`Node ${node} links outside layer ${level}`);
      graph.setNeighbors(node, level, links);
    }
  }
  return { graph, vectors };
}
