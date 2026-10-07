# Search research: HNSW and the distance between paintings

Phase 5's groundwork, Oct 7, 2026: how far apart two paintings' color schemes are, and how to find the nearest ones fast. The measurements ran on the gallery's 48,695 color strips (`app/public/data/strips`); CLAUDE.md keeps the decisions, this note the evidence.

## The distance between two paintings

### What a painting brings

The gallery stores one strip per painting: the color strip, 128 segments, each the linear-light mean of an equal share of the picture's pixels. So a strip is a distribution of color, 128 equal masses. That makes it a *signature* in Rubner's sense, the representation the color retrieval literature compares best.

### What the literature says

- **Earth Mover's Distance (EMD)**: Rubner, Tomasi and Guibas, [The Earth Mover's Distance as a Metric for Image Retrieval](https://people.eecs.berkeley.edu/~efros/courses/LBMV07/Papers/rubner-jcviu-00.pdf) (IJCV 2000). The least average color difference that turns one distribution into the other. On 20,000 Corel photos, EMD on k-means color signatures in CIELab found more relevant images than every histogram measure (L1, χ², Jeffrey divergence, quadratic form). Two findings matter here: measures that compare bin by bin depend on the bin size (too coarse can't tell colors apart, too fine splits similar colors), and the quadratic-form distance overstates how alike distributions without a clear peak are. Its cost: an optimal matching per pair, about 6 ms for two 128-segment strips in JavaScript, too slow to compare a query with every painting.
- **Thresholded EMD**: Pele and Werman, [Fast and Robust Earth Mover's Distances](https://mlanthology.org/iccv/2009/pele2009iccv-fast/) (ICCV 2009). Capping the ground distance (beyond some difference, colors are just "different") matches human judgment better and is faster.
- **Hellinger distance**: Arandjelović and Zisserman, [Three things everyone should know to improve object retrieval](https://ora.ox.ac.uk/objects/uuid:423bf16b-4ac6-4e41-bf34-bb7c20ba1b99) (CVPR 2012). Square roots of a normalized histogram turn the Hellinger kernel into plain Euclidean distance (RootSIFT). This was the design doc's plan: a soft histogram over a color vocabulary, compared this way.
- **Sliced Wasserstein**: Rabin, Peyré, Delon and Bernot, *Wasserstein Barycenter and its Application to Texture Mixing* (2011), and Kolouri et al., [Sliced Wasserstein Kernels for Probability Distributions](https://arxiv.org/abs/1511.03198) (CVPR 2016). Along a line, the EMD has a closed form: sort both sides and pair them in order. Projecting the colors onto several directions and averaging the 1D distances gives a true metric between distributions, and a Euclidean (or L1) embedding of it: the sorted projections themselves.
- **In practice**: Google Arts & Culture's [Art Palette](https://www.core77.com/posts/76088/Experimental-Google-Tool-Lets-You-Search-Art-by-Palette) searches artworks by color: a 5-color palette per image, a learned embedding of the palette, Euclidean nearest neighbors. A learned model needs training data we don't have; the transport distances need none.

### Measured on the gallery

240 random paintings as queries. The reference is the exact EMD (W1, Euclidean ground distance in OKLrab) between their strips and every other painting's, found with a lower bound so that only a few hundred optimal matchings per query were needed. Also shown against the exact W2 (squared ground distance). *Recall* is the share of the reference's 10 nearest that each candidate's 10 nearest contain; *farther* is how much farther, by the reference, its 10 nearest lie on average.

| Candidate (numbers per painting) | vs EMD: recall | farther | vs W2: recall | farther |
|---|---|---|---|---|
| Mean color (3) | 3% | 161% | 3% | 162% |
| Sliced, 4 directions × 16 shares, Euclidean (64) | 66% | 4.3% | 73% | 3.2% |
| Sliced, 8 × 8, L1 (64) | 71% | 3.0% | 60% | 6.9% |
| **Sliced, 8 × 16, L1 (128)** | **78%** | **1.8%** | 65% | 5.2% |
| Sliced, 8 × 16, Euclidean (128) | 69% | 3.4% | 78% | 2.2% |
| Sliced, 16 × 16, L1 (256) | 80% | 1.7% | 65% | 5.1% |
| Histogram, 128 colors, Hellinger, σ = 0.064 | 45% | 13.5% | 50% | 11.1% |
| Histogram, σ = 0.096 | 41% | 15.2% | 48% | 11.7% |
| Histogram, σ = 0.128 | 36% | 19.6% | 42% | 15.9% |

The exact nearest painting was among the sliced embedding's 10 nearest for 99% of the queries. A first run on 24 queries tried vocabularies of 64, 128 and 256 colors and widths of 0.5 to 2 times the vocabulary's spacing; no histogram reached 43%.

What the table shows:

- Spreading each color over nearby vocabulary colors doesn't make a histogram a transport distance: it still treats two colors a little beyond its width as unrelated, which the EMD doesn't.
- L1 on the sliced embedding tracks the EMD (W1), and Euclidean tracks W2, as the theory says. The EMD is the measure the retrieval studies found to match perception, and it is the more forgiving of a small area of odd color, so L1 it is.
- More directions help a little (16 → 80%) for twice the numbers; 8 × 16 = 128 keeps the vectors small.

A sheet of six queries (four famous paintings and two benchmark renders) with their six nearest under the exact EMD, the sliced embedding and the histogram showed the same: the sliced picks were mostly the EMD's own, while the histogram's strayed further from them.

### The decision

`vectorize` turns a color strip into 128 numbers: its colors, in OKLrab, projected onto 8 directions spread evenly over a hemisphere (a Fibonacci lattice), sorted, and averaged over 16 equal shares. Two paintings' distance is the mean absolute difference of their vectors: the EMD along each direction, averaged, in OKLab units (0.02 is just noticeable). Properties the tests check: it depends only on the colors and their shares, never exceeds the exact EMD, gives a slightly brighter copy of an image a distance below 0.02, and an image 0 from itself.

Left for later: re-ranking the index's best 30 to 50 candidates by the exact EMD (0.2 to 0.3 s per search) if results ever look off; a thresholded ground distance (Pele and Werman); layout, which would need data the gallery doesn't store.

## HNSW

### The algorithm, as published

Malkov and Yashunin, [Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs](https://arxiv.org/abs/1603.09320) (TPAMI 2018):

- Every node draws a level, floor(−ln(U) · m_L), with m_L = 1/ln(M): each layer holds about 1/M of the nodes of the one below, as in a skip list.
- INSERT (Algorithm 1): walk greedily down to the node's level, then on each of its layers search with efConstruction candidates (SEARCH-LAYER, Algorithm 2), link to M of them, link them back, and prune any node whose links overflow: M_max = M on the upper layers, M_max0 = 2M on the bottom one ("2·M is a good choice").
- SELECT-NEIGHBORS-HEURISTIC (Algorithm 4): keep a candidate only if it is closer to the node than to every link kept so far, so links spread in different directions and bridge clusters. The paper finds it never worse than taking the nearest (Algorithm 3), and far better on clustered data. Its two options, extending the candidates and keeping pruned ones, are off by default; the first is meant only for extremely clustered data.
- K-NN-SEARCH (Algorithm 5): greedy (ef = 1) down to layer 1, then SEARCH-LAYER with ef on the bottom layer.
- M from 5 to 48; small M suits low-dimensional data and modest recall. efConstruction just large enough that construction recall nears 1.

### How others built it

- **hnswlib** ([code](https://github.com/nmslib/hnswlib)), the paper authors' library: the bottom layer in one contiguous block per node (link count, links, vector, label), upper layers in separate blocks; a visited list per search that is cleared by bumping a tag rather than zeroing it; the heuristic without the paper's two options; greedy upper-layer descent; seeded level generator; defaults M = 16, efConstruction = 200, M_max0 = 2M.
- **FAISS** ([HNSW](https://faiss.ai/cpp_api/struct/structfaiss_1_1HNSW.html)): all levels' links in one array with per-node offsets, 2M links on level 0 and M above.
- **Lucene** ([format](https://lucene.apache.org/core/9_9_1/core/org/apache/lucene/codecs/lucene99/Lucene99HnswVectorsFormat.html)): stores each node's neighbor list as a count and delta-encoded variable-length integers, and vectors as float32 or bytes. A model for our binary file.
- **In the browser**: [MeMemo](https://arxiv.org/abs/2407.01972) (SIGIR 2024, TypeScript) keeps vectors in IndexedDB and builds in the browser, which took 94 minutes for a million 384-dimensional vectors; [hnswlib-wasm](https://www.npmjs.com/package/hnswlib-wasm) compiles hnswlib with Emscripten; [hnsw](https://www.npmjs.com/package/hnsw) is a small TypeScript version with one object per node; [EdgeVec](https://docs.rs/edgevec) is Rust compiled to WebAssembly. The lesson for a static gallery: build offline, ship a compact binary, and search typed arrays rather than objects.

### Research since

- **Is the hierarchy needed?** Munyampirwa et al., [Down with the Hierarchy: The 'H' in HNSW Stands for "Hubs"](https://arxiv.org/abs/2412.01940) (ICML 2025): above about 32 dimensions a flat graph searches as fast, its hubs doing the layers' job; below, the layers help, and the dimension matters more than the number of vectors. The paintings' vectors have an intrinsic dimension of about 11 (TwoNN estimate), so we keep the layers, which the Lab needs to show anyway.
- **What matters most**: Wang et al., [A Comprehensive Survey and Experimental Comparison of Graph-Based Approximate Nearest Neighbor Search](https://arxiv.org/abs/2101.12631) (VLDB 2021): neighbor selection that accounts for the candidates' spread (HNSW's heuristic, a relative neighborhood graph) is the component that pays most.
- **Variants**: DiskANN's Vamana prunes with a factor α > 1 that keeps some longer links ([comparison](https://weaviate.io/blog/ann-algorithms-vamana-vs-hnsw)); an option for the Lab, not needed for recall here.
- **Unreachable nodes**: Xiao et al., [Enhancing HNSW Index for Real-Time Updates](https://arxiv.org/abs/2407.07871) (2024): pruning can leave a node with no links into it, so no search finds it. Mostly a problem of deletions, which a static gallery never has; a test checks that every painting finds itself.
- **Memory layout**: Coleman et al., [Graph Reordering for Cache-Efficient Near Neighbor Search](https://arxiv.org/abs/2104.03221) (NeurIPS 2022): renumbering nodes so that neighbors sit together speeds search by 10 to 40% on large indexes; not worth it at our size.

### Measured on the gallery

The 48,695 vectors, L1 distance, 1,000 queries, recall@10 against brute force, in Node:

| M | efConstruction | build | ef 16 | ef 32 | ef 64 |
|---|---|---|---|---|---|
| 8 | 100 | 19 s | 0.979, 0.12 ms | 0.996, 0.17 ms | 1.000, 0.31 ms |
| 12 | 200 | 37 s | 0.993, 0.15 ms | 0.999, 0.23 ms | 1.000, 0.29 ms |
| **16** | **200** | **39 s** | **0.996, 0.17 ms** | **1.000, 0.25 ms** | **1.000, 0.40 ms** |

Brute force takes 14 ms per query. With M = 16 and efConstruction = 200 every painting finds itself; smaller settings lost 1 to 7.

Honestly put: at this size a brute-force search is fast enough for a single query in a Worker. HNSW makes it about 60 times faster, leaves room for a larger gallery, and is what the Lab shows; and the browser has to download the vectors either way.

### How ours is shaped

- **Self-contained**: `@palette-atlas/hnsw` depends on no other library. It takes `Vectors` of any length in one `Float32Array`, a `Distance` (Strategy, squared Euclidean by default; the paintings use `colorSchemeDistance`, L1) and a `Random` for the levels. `HnswIndex` and `BruteForceIndex` share the `VectorIndex` interface, so tests swap them.
- **Built offline, static**: the pipeline builds once with a seed, so the graph is the same every time; no deletions or updates.
- **Typed arrays throughout**: links in one `Int32Array` laid out like hnswlib's (each node's bottom-layer block, then the upper blocks), degrees in a `Uint16Array`, levels in a `Uint8Array`; heaps of ids and distances in typed arrays; visited marks cleared by a new tag per search.
- **The paper's algorithms, hnswlib's choices**: the heuristic without extensions, M_max0 = 2M, m_L = 1/ln M, the found candidates as the next layer's entry points (the paper's ep ← W), greedy descent above the bottom layer.
- **Defaults**: M = 16, efConstruction = 200, ef = 64 (recall 1.000 on the paintings at ef = 32).

### Next steps

1. The search trace (Observer, with a no-op tracer when nobody records).
2. The binary file: uint8 vectors and compact links, with a round-trip test, and recall measured after quantization.
3. The pipeline builds the index into `app/public/data`.
4. The browser: decide between downloading the vectors and computing them from the shipped strips, then upload an image and show its nearest paintings, mocked in the real page first.
