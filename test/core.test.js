import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TimerPrecisionBucket, createTimerPrecisionBucket } from '../src/index.js';

test('constructor rejects invalid interval', () => {
  assert.throws(() => new TimerPrecisionBucket(0), RangeError);
  assert.throws(() => new TimerPrecisionBucket(-1), RangeError);
  assert.throws(() => new TimerPrecisionBucket(1.5), RangeError);
  assert.throws(() => new TimerPrecisionBucket('10'), RangeError);
});

test('constructor rejects invalid clock', () => {
  assert.throws(() => new TimerPrecisionBucket(10, null), TypeError);
  assert.throws(() => new TimerPrecisionBucket(10, {}), TypeError);
});

test('bucketStart aligns to interval', () => {
  const b = new TimerPrecisionBucket(100);
  assert.equal(b.bucketStart(0), 0);
  assert.equal(b.bucketStart(99), 0);
  assert.equal(b.bucketStart(100), 100);
  assert.equal(b.bucketStart(101), 100);
  assert.equal(b.bucketStart(199), 100);
  assert.equal(b.bucketStart(200), 200);
});

test('bucketStart rejects non-finite values', () => {
  const b = new TimerPrecisionBucket(100);
  assert.throws(() => b.bucketStart(NaN), TypeError);
  assert.throws(() => b.bucketStart(Infinity), TypeError);
  assert.throws(() => b.bucketStart('5'), TypeError);
});

test('add groups values into correct buckets', () => {
  const b = new TimerPrecisionBucket(100);
  b.add(5);
  b.add(50);
  b.add(105);
  b.add(250);
  assert.deepEqual(b.bucketStarts(), [0, 100, 200]);
  assert.deepEqual(b.valuesIn(0), [5, 50]);
  assert.deepEqual(b.valuesIn(100), [105]);
  assert.deepEqual(b.valuesIn(200), [250]);
  assert.deepEqual(b.valuesIn(300), []);
});

test('addNow uses the provided clock', () => {
  let now = 42;
  const clock = () => now;
  const b = new TimerPrecisionBucket(10, clock);
  b.addNow();
  now = 47;
  b.addNow();
  now = 55;
  b.addNow();
  assert.deepEqual(b.valuesIn(40), [42, 47]);
  assert.deepEqual(b.valuesIn(50), [55]);
});

test('addNow rejects non-finite clock return', () => {
  const b = new TimerPrecisionBucket(10, () => NaN);
  assert.throws(() => b.addNow(), TypeError);
});

test('clear removes all buckets', () => {
  const b = new TimerPrecisionBucket(100);
  b.add(1);
  b.add(2);
  b.clear();
  assert.equal(b.size(), 0);
  assert.deepEqual(b.bucketStarts(), []);
});

test('size counts all values', () => {
  const b = new TimerPrecisionBucket(100);
  assert.equal(b.size(), 0);
  b.add(1);
  b.add(2);
  b.add(300);
  assert.equal(b.size(), 3);
});

test('allValues returns values grouped by ascending bucket start', () => {
  const b = new TimerPrecisionBucket(100);
  b.add(10);
  b.add(20);
  b.add(110);
  b.add(5);
  assert.deepEqual(b.allValues(), [10, 20, 5, 110]);
});

test('valuesIn returns a copy', () => {
  const b = new TimerPrecisionBucket(100);
  b.add(10);
  const copy = b.valuesIn(0);
  copy.push(999);
  assert.deepEqual(b.valuesIn(0), [10]);
});

test('percentile uses nearest-rank method', () => {
  const b = new TimerPrecisionBucket(100);
  // Values: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
  for (let i = 1; i <= 10; i++) b.add(i);
  assert.equal(b.percentile(0), 1);
  assert.equal(b.percentile(10), 1);
  assert.equal(b.percentile(25), 3);
  assert.equal(b.percentile(50), 5);
  assert.equal(b.percentile(75), 8);
  assert.equal(b.percentile(90), 9);
  assert.equal(b.percentile(100), 10);
});

test('percentile on empty bucket returns NaN', () => {
  const b = new TimerPrecisionBucket(100);
  assert.ok(Number.isNaN(b.percentile(50)));
});

test('percentile rejects invalid arguments', () => {
  const b = new TimerPrecisionBucket(100);
  assert.throws(() => b.percentile(-1), RangeError);
  assert.throws(() => b.percentile(101), RangeError);
  assert.throws(() => b.percentile(NaN), TypeError);
  assert.throws(() => b.percentile('50'), TypeError);
});

test('factory function creates an instance', () => {
  const b = createTimerPrecisionBucket(50);
  assert.ok(b instanceof TimerPrecisionBucket);
  assert.equal(b.intervalMs, 50);
});

test('factory function uses default interval', () => {
  const b = createTimerPrecisionBucket();
  assert.equal(b.intervalMs, 100);
});
