/* Rng: the game's seeded random numbers (Part 13).
   Same algorithm as the test scripts (mulberry32), so a seed gives the same numbers everywhere.
   Rng.seeded(seed) returns a function rng() -> number from 0 to 1, like Math.random.
   It also has getState() and setState(n), so a saved game continues the same sequence after loading.
   Rule code only. No screen code. */

class Rng {
  static seeded(seed) {
    let a = seed | 0;
    const rng = function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.getState = () => a;
    rng.setState = s => { a = s | 0; };
    return rng;
  }
  /* A seed from the clock, for live games. */
  static randomSeed() { return (Date.now() ^ Math.floor(Math.random() * 4294967296)) | 0; }
  /* True if this rng's place in its sequence can be saved. */
  static canSave(rng) { return typeof rng === "function" && typeof rng.getState === "function" && typeof rng.setState === "function"; }
}

export { Rng };
