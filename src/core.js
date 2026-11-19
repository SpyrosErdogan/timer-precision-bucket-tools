const DEFAULT_INTERVAL_MS = 100;

/**
 * Groups elapsed millisecond values into buckets aligned to a configurable interval.
 *
 * Bucket boundaries are determined by `Math.floor(ms / intervalMs) * intervalMs`.
 * This yields buckets such as [0, interval), [interval, 2*interval), etc.
 * Values are grouped by their bucket start time, and each bucket stores the
 * raw elapsed values that fell into the bucket.
 */
export class TimerPrecisionBucket {
  /**
   * @param {number} intervalMs - Bucket width in milliseconds. Must be a positive integer.
   * @param {() => number} [clock] - Optional clock function returning elapsed milliseconds.
   *   Defaults to `Date.now`. Tests should pass a fake clock to avoid wall-clock dependence,
   *   because the library must be deterministic when used with a controlled clock.
   */
  constructor(intervalMs = DEFAULT_INTERVAL_MS, clock = Date.now) {
    if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
      throw new RangeError('intervalMs must be a positive integer');
    }
    if (typeof clock !== 'function') {
      throw new TypeError('clock must be a function');
    }
    this.intervalMs = intervalMs;
    this.clock = clock;
    /** @type {Map<number, number[]>} */
    this.buckets = new Map();
  }

  /**
   * Returns the bucket start for a given elapsed millisecond value.
   * @param {number} ms
   * @returns {number}
   */
  bucketStart(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms)) {
      throw new TypeError('elapsed value must be a finite number');
    }
    return Math.floor(ms / this.intervalMs) * this.intervalMs;
  }

  /**
   * Adds an elapsed millisecond value to the bucket it belongs to.
   * @param {number} ms
   */
  add(ms) {
    const start = this.bucketStart(ms);
    let bucket = this.buckets.get(start);
    if (bucket === undefined) {
      bucket = [];
      this.buckets.set(start, bucket);
    }
    bucket.push(ms);
  }

  /**
   * Convenience method: reads the current elapsed time from the clock and adds it.
   * The clock is expected to return elapsed milliseconds. This method exists so
   * callers can record durations without manually reading the clock.
   */
  addNow() {
    const now = this.clock();
    if (typeof now !== 'number' || !Number.isFinite(now)) {
      throw new TypeError('clock must return a finite number');
    }
    this.add(now);
  }

  /**
   * Returns the bucket start times in ascending order.
   * @returns {number[]}
   */
  bucketStarts() {
    return [...this.buckets.keys()].sort((a, b) => a - b);
  }

  /**
   * Returns all elapsed values in a given bucket, or an empty array if the bucket is empty.
   * The returned array is a copy, so mutating it does not affect the internal state.
   * @param {number} start
   * @returns {number[]}
   */
  valuesIn(start) {
    const bucket = this.buckets.get(start);
    return bucket === undefined ? [] : bucket.slice();
  }

  /**
   * Removes all buckets and their values.
   */
  clear() {
    this.buckets.clear();
  }

  /**
   * Returns the total number of elapsed values across all buckets.
   * @returns {number}
   */
  size() {
    let total = 0;
    for (const bucket of this.buckets.values()) {
      total += bucket.length;
    }
    return total;
  }

  /**
   * Computes the p-th percentile (0 <= p <= 100) over all stored elapsed values.
   * Uses the nearest-rank method: the value at index `ceil(p/100 * n) - 1` in the
   * sorted list of all values. This method is chosen because it is simple, deterministic,
   * and does not require interpolation; it matches the common definition used for
   * latency percentiles where the result should always be an observed value.
   *
   * @param {number} p
   * @returns {number} The percentile value, or NaN if there are no values.
   */
  percentile(p) {
    if (typeof p !== 'number' || !Number.isFinite(p)) {
      throw new TypeError('percentile must be a finite number');
    }
    if (p < 0 || p > 100) {
      throw new RangeError('percentile must be between 0 and 100');
    }
    const all = this.allValues();
    if (all.length === 0) {
      return NaN;
    }
    all.sort((a, b) => a - b);
    const rank = Math.ceil((p / 100) * all.length);
    const index = Math.min(Math.max(rank - 1, 0), all.length - 1);
    return all[index];
  }

  /**
   * Returns a flat array of all stored elapsed values, in insertion order.
   * @returns {number[]}
   */
  allValues() {
    const result = [];
    const starts = this.bucketStarts();
    for (const start of starts) {
      result.push(...this.buckets.get(start));
    }
    return result;
  }
}

/**
 * Factory function for creating a TimerPrecisionBucket.
 * @param {number} [intervalMs]
 * @param {() => number} [clock]
 * @returns {TimerPrecisionBucket}
 */
export function createTimerPrecisionBucket(intervalMs, clock) {
  return new TimerPrecisionBucket(intervalMs, clock);
}
