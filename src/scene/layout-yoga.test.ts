import { test, before } from 'node:test';
import assert from 'node:assert/strict';

import { computeLayoutYoga, loadYogaEngine } from './layout-yoga';
import type { BoxNode, RootContainer } from './types';

/**
 * Pins the layout semantics this engine deliberately DIVERGES from CSS on.
 * They are stated in the layout-yoga.ts header comment and enforced nowhere
 * else — if any of them silently reverts to the CSS default, every widget on
 * the bar moves. See the header comment for the full list; these are the ones
 * that are cheap to assert and easiest to break.
 */

before(async () => { await loadYogaEngine(); });

const box = (props: Partial<BoxNode> = {}): BoxNode => ({
  type: 'box',
  color: '#fff',
  children: [],
  ...props,
});

const root = (children: BoxNode[], width = 200, height = 100): RootContainer => ({
  type: 'root', children, width, height,
});

const boxAt = (boxes: Map<unknown, { x: number; y: number; w: number; h: number }>, n: BoxNode) => {
  const b = boxes.get(n);
  assert.ok(b, 'node missing from layout results');
  return b;
};

test('flexDirection defaults to row, not the CSS default of column', () => {
  const a = box({ width: 40, height: 10 });
  const b = box({ width: 60, height: 10 });
  const boxes = computeLayoutYoga(root([box({ children: [a, b] })]), 200, 100);

  // Row: b sits to the RIGHT of a. Column would stack it below.
  assert.equal(boxAt(boxes, a).x, 0);
  assert.equal(boxAt(boxes, b).x, 40);
  assert.equal(boxAt(boxes, a).y, boxAt(boxes, b).y);
});

test('flexDirection: column stacks children vertically', () => {
  const a = box({ width: 40, height: 10 });
  const b = box({ width: 60, height: 10 });
  const boxes = computeLayoutYoga(root([box({ style: { flexDirection: 'column' }, children: [a, b] })]), 200, 100);

  assert.equal(boxAt(boxes, b).y, 10);
  assert.equal(boxAt(boxes, a).x, boxAt(boxes, b).x);
});

test('`flex: N` means grow N with flexBasis 0, so siblings split the free space by N', () => {
  const a = box({ style: { flex: 1 } });
  const b = box({ style: { flex: 2 } });
  const boxes = computeLayoutYoga(root([box({ children: [a, b] })]), 300, 100);

  assert.equal(boxAt(boxes, a).w, 100); // 1/(1+2) of 300
  assert.equal(boxAt(boxes, b).w, 200); // 2/(1+2) of 300
});

test('items do not shrink unless they opt in with flexShrink', () => {
  // Two 200px children in a 200px row overflow unless shrink is set. The CSS
  // default is flex-shrink: 1, which would squash them to fit.
  const a = box({ width: 200, height: 10 });
  const b = box({ width: 200, height: 10 });
  const boxes = computeLayoutYoga(root([box({ children: [a, b] })]), 200, 100);

  assert.equal(boxAt(boxes, a).w, 200);
  assert.equal(boxAt(boxes, b).w, 200);
});

test('position:absolute sizes to its explicit width/height, not to content', () => {
  const child = box({ style: { position: 'absolute', width: 50, height: 20 } });
  const boxes = computeLayoutYoga(root([box({ children: [child] })]), 200, 100);

  assert.equal(boxAt(boxes, child).w, 50);
  assert.equal(boxAt(boxes, child).h, 20);
});

test('an absolute node with no explicit dimensions gets 0, not the containing box', () => {
  const child = box({ style: { position: 'absolute' } });
  const boxes = computeLayoutYoga(root([box({ children: [child] })]), 200, 100);

  assert.equal(boxAt(boxes, child).w, 0);
  assert.equal(boxAt(boxes, child).h, 0);
});

test('root children fill the screen when no explicit size is set', () => {
  const child = box();
  const boxes = computeLayoutYoga(root([child]), 200, 100);

  assert.equal(boxAt(boxes, child).w, 200);
  assert.equal(boxAt(boxes, child).h, 100);
});

test('coordinates stay fractional — pixel-grid rounding is disabled', () => {
  // A third of 200 is 66.666...; rounding here would visibly shift widgets.
  const a = box({ style: { flex: 1 } });
  const b = box({ style: { flex: 1 } });
  const c = box({ style: { flex: 1 } });
  const boxes = computeLayoutYoga(root([box({ children: [a, b, c] })]), 200, 100);

  assert.equal(boxAt(boxes, b).x % 1 !== 0, true, 'expected a fractional x');
});
