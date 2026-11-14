/* Hearts: a player's safety pool. Starts at 3, cap 3.
   Only these methods change the count: spend, refill, refund, lose, empty.
   Everything else reads it through .count, .has(n) and .isFull().
   Rule code only. No screen code. Works in the browser and in Node. */
(function (root) {
  const EP = root.EP || (root.EP = {});

  const START = 3, CAP = 3;

  class Hearts {
    #n;
    constructor(start = START) { this.#n = Math.max(0, Math.min(CAP, start)); }

    static get START() { return START; }
    static get CAP() { return CAP; }

    get count() { return this.#n; }
    has(n) { return this.#n >= n; }
    isFull() { return this.#n >= CAP; }

    /* Pay n hearts. Refused (returns false, nothing changes) if there are not enough. */
    spend(n) {
      if (n < 0 || this.#n < n) return false;
      this.#n -= n;
      return true;
    }
    /* End of round, and similar small refills: +n, capped. */
    refill(n = 1) { this.#n = Math.min(CAP, this.#n + n); }
    /* Hearts coming back (declined gift, overflow): +n, capped. */
    refund(n) { this.#n = Math.min(CAP, this.#n + n); }
    /* A penalty (Empathy): -n, never below 0. */
    lose(n) { this.#n = Math.max(0, this.#n - n); }
    /* Reboot: set to 0. */
    empty() { this.#n = 0; }
  }

  EP.Hearts = Hearts;
  if (typeof module !== "undefined" && module.exports) module.exports = Hearts;
})(typeof globalThis !== "undefined" ? globalThis : this);
