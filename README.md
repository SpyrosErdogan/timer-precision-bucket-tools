# timer-precision-bucket-tools

Groups elapsed milliseconds into buckets aligned to a configurable interval so that percentile calculations can be performed over a rolling window.

## Usage

```js
import { TimerPrecisionBucket } from './src/index.js';

const bucket = new TimerPrecisionBucket(100); // 100 ms buckets

bucket.add(5);
bucket.add(50);
bucket.add(105);

console.log(bucket.bucketStarts()); // [0, 100]
console.log(bucket.valuesIn(0));    // [5, 50]
console.log(bucket.percentile(50)); // 50
```

## Why this exists

When measuring latencies, you often want percentiles over a recent window rather than the entire history. Storing every raw value forever is expensive, and recomputing percentiles from scratch on every request is wasteful. This library groups elapsed values into fixed-width time buckets aligned to a configurable interval. Each bucket holds the individual elapsed values that fell into it, so you can compute percentiles exactly over the retained window. The trade-off is memory: we keep the raw values, not just aggregates, because exact percentiles require the full distribution. If you need to bound memory, you can drop old buckets yourself; the library does not impose a retention policy.

## Edge case: percentile method

The `percentile(p)` method uses the nearest-rank method: it sorts all stored values and returns the value at index `ceil(p/100 * n) - 1`. This means the result is always an observed value, never an interpolated one. For example, with 10 values, `percentile(50)` returns the 5th smallest value. This is a deliberate choice for latency percentiles, where an interpolated value can be misleading. If you need a different definition, you can compute it yourself from `allValues()`.

## API

- `new TimerPrecisionBucket(intervalMs = 100, clock = Date.now)`
- `bucketStart(ms)` — returns the bucket start for an elapsed value.
- `add(ms)` — adds an elapsed value to its bucket.
- `addNow()` — reads `clock()` and adds the result.
- `bucketStarts()` — returns sorted bucket start times.
- `valuesIn(start)` — returns a copy of the values in a bucket.
- `allValues()` — returns all stored values in insertion order.
- `size()` — total number of stored values.
- `clear()` — removes all buckets.
- `percentile(p)` — nearest-rank percentile over all stored values; returns `NaN` when empty.
- `createTimerPrecisionBucket(intervalMs, clock)` — factory function.
