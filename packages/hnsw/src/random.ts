/** A source of random numbers in [0, 1). A seeded one makes a build repeatable. */
export interface Random {
  next(): number;
}
