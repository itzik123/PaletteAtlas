# Searching 48,695 paintings by color scheme, in the browser

[Palette Atlas](https://itzik123.github.io/PaletteAtlas/) takes an image and finds the public-domain paintings whose colors are closest to it. The site is static: the image is read in the browser, and the search runs there too, against an index built offline. This note covers the three parts that do the work: how a painting becomes a vector, how two vectors are compared, and the HNSW index that finds the nearest ones. The same TypeScript libraries run in the offline pipeline (Node) and in the browser, so a visitor's image and a gallery painting are read by the same code.

The gallery is 48,695 paintings from Wikidata, with images from Wikimedia Commons (only files marked public domain or CC0).

## A painting as a distribution of color

An image is first shrunk to 256 px, averaging in linear light. Canvas and `createImageBitmap` scaling usually average the gamma-encoded sRGB values, which darkens the mix wherever light and dark meet.

k-means in OKLab then finds a palette of 8 colors. Plain k-means tends to fold a small accent into a large cluster nearby, so the palette grows, up to 16 colors, while more than 0.5% of the pixels lie farther than 0.15 from every palette color.

The pixels are ordered along a path through the palette (the shortest one, solved exactly with Held-Karp, since there are at most 16 colors), cut into 128 runs of equal size, and each run is averaged in linear light. The result is a strip of 128 colors of equal weight: a distribution in which each color appears in proportion to its area. The order is for display. The search only uses the distribution.

## Comparing two distributions

The standard measure here is the Earth Mover's Distance ([Rubner et al., 2000](https://people.eecs.berkeley.edu/~efros/courses/LBMV07/Papers/rubner-jcviu-00.pdf)): the least average color difference needed to turn one distribution into the other. In retrieval studies it matched perception better than histogram distances. It needs an optimal matching per pair, about 6 ms for two 128-color strips in JavaScript, so comparing one query with the whole gallery would take about 5 minutes.

In one dimension the EMD is simple: sort both sides and pair them in order. The sliced Wasserstein distance builds on that. Project the colors onto several directions, take the 1D distance along each, and average.

The vector: the strip's colors in OKLrab (OKLab with Ottosson's lightness toe), projected onto 8 directions spread over a hemisphere by a Fibonacci lattice. Along each direction the projections are sorted and averaged over 16 equal shares, giving 8 × 16 = 128 numbers. The mean absolute difference between two such vectors is then the 1D EMD along each direction, averaged over the directions. It never exceeds the true EMD.

```ts
for (let slice = 0; slice < SLICES; slice++) {
  const [l, a, b] = DIRECTIONS.subarray(slice * 3, slice * 3 + 3);
  for (let i = 0; i < count; i++) {
    projections[i] = colors[3 * i] * l + colors[3 * i + 1] * a + colors[3 * i + 2] * b;
  }
  averageQuantiles(projections.sort(), vector, slice * QUANTILES);
}
```

To check it, I took 240 random paintings as queries and computed the exact EMD from each to every other painting. *Overlap* is the share of the exact top 10 that each method's top 10 contains; *farther* is how much farther, by the exact EMD, its top 10 lie on average.

| Vector | Numbers | Overlap | Farther |
|---|---|---|---|
| Mean color | 3 | 3% | 161% |
| Color histogram, Hellinger distance | 128 | 45% | 13.5% |
| Sliced, 8 × 16, Euclidean | 128 | 69% | 3.4% |
| Sliced, 8 × 16, L1 | 128 | 78% | 1.8% |

The exact nearest painting was in the sliced top 10 for 99% of the queries. L1 tracks the EMD (W1). Euclidean distance on the same vectors tracks W2 instead: 78% against the exact W2.

## The index

Brute force over 48,695 vectors of 128 numbers takes 14 ms per query in Node, which would be fine for one query. I wrote HNSW ([Malkov and Yashunin](https://arxiv.org/abs/1603.09320)) anyway. It is about 60 times faster, and its layered graph is what the site's Lab page draws.

- Everything lives in typed arrays. Links sit in one `Int32Array`, laid out like hnswlib's (each node's bottom-layer block, then the upper layers). Degrees are a `Uint16Array` and levels a `Uint8Array`. The visited set is cleared by bumping a tag rather than zeroing it.
- Neighbors are chosen by the paper's heuristic (Algorithm 4) without its two extensions. M_max0 = 2M and m_L = 1/ln M. Levels come from a seeded generator, so the build is deterministic.
- The distance is passed in, so the same index searches the paintings with L1 and the test points with squared Euclidean.

Recall@10 against brute force over 1,000 queries:

| M | efConstruction | Build | ef 16 | ef 32 | ef 64 |
|---|---|---|---|---|---|
| 8 | 100 | 19 s | 0.979, 0.12 ms | 0.996, 0.17 ms | 1.000, 0.31 ms |
| 16 | 200 | 39 s | 0.996, 0.17 ms | 1.000, 0.25 ms | 1.000, 0.40 ms |

The site uses M = 16. [Munyampirwa et al. (2025)](https://arxiv.org/abs/2412.01940) found that above about 32 dimensions a flat graph searches as fast as HNSW, its hubs doing the job of the layers. These vectors have 128 numbers but an intrinsic dimension of about 11 (TwoNN estimate), so the layers still help.

### Landmarks on the top layer

Levels are drawn at random, which left 2 paintings on the top layer. I replaced it with 8 landmarks: k-means on the paintings' mean colors, then, for each cluster, the painting whose vector lies nearest the cluster's mean. Every other painting keeps its drawn level.

Over 1,200 queries, searches measured 2,558 paintings on average, against 2,556 before, and found all of the true 10 nearest. So the change is free, and the top layer now holds one typical painting per color family, from near-black to near-white. Landmarks chosen to be as far apart as possible cost 10 measurements more.

## The file

The browser needs the vectors and the graph. As float32, the vectors alone are 25 MB.

- **Vectors:** one byte per number, with a minimum and maximum per dimension. Recall@10 after the round trip is 98%.
- **Links:** each node's links are sorted and stored as the gaps between them, in variable-length integers, as Lucene does. That comes to 1.65 MB.
- **Layout:** the vectors are stored dimension by dimension, each byte as its difference from the same painting's previous dimension. Within a direction the 16 shares are sorted, so neighboring numbers are close and the differences are small. Gzip shrinks the vectors to 3.8 MB this way, against 5.5 MB in the plain layout.

The whole file is 7.9 MB, or 5.4 MB gzipped. A Web Worker downloads it once, unzips it with `DecompressionStream`, and answers each search in about a millisecond.

## Watching the search

The search reports each step to a tracer:
- the layer it enters
- each node it measures
- each node whose links it follows
- the nodes that join or leave its current best set (the paper's W)

By default it reports to a no-op tracer, which timed within noise of no tracer at all. The [Lab](https://itzik123.github.io/PaletteAtlas/lab.html) attaches a recorder to the same search the Atlas runs: the 601 nearest, greedy on the upper layers and ef = 601 on the bottom one. It then replays the record over a map of the paintings, the first two principal components of their vectors (92.5% of the variance). A search measures about 2,600 of the 48,695 paintings. The page also runs brute force and checks that the 10 nearest agree.

## Links

- The site: https://itzik123.github.io/PaletteAtlas/
- The source (MIT): https://github.com/itzik123/PaletteAtlas
- Measurements and references: [search-research.md](search-research.md)
