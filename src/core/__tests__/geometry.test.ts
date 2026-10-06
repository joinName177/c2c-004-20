import { describe, expect, it } from 'vitest';
import { diagnoseFit, intersects, rotationsOf } from '../geometry';
import type { Dimensions, PackingItem, Placement } from '../models';

const item = (length: number, width: number, height: number) => ({ length, width, height }) as PackingItem;
const box: Dimensions = { length: 10, width: 8, height: 6 };

describe('rotationsOf', () => {
  it('returns six unique rotations for three unequal edges', () => {
    expect(rotationsOf(item(2, 3, 4))).toHaveLength(6);
  });

  it('removes duplicate rotations for a cube', () => {
    expect(rotationsOf(item(3, 3, 3))).toEqual([{ length: 3, width: 3, height: 3 }]);
  });
});

describe('intersects', () => {
  const box = (x: number, y: number, z: number): Placement => ({
    itemId: 'box', x, y, z, dimensions: { length: 2, width: 2, height: 2 },
  });

  it('allows boxes whose faces only touch', () => {
    expect(intersects(box(0, 0, 0), box(2, 0, 0))).toBe(false);
  });

  it('detects boxes with overlapping volume', () => {
    expect(intersects(box(0, 0, 0), box(1, 1, 1))).toBe(true);
  });
});

describe('diagnoseFit', () => {
  it('finds a fitting rotation even when the stored orientation does not fit', () => {
    const result = diagnoseFit(item(2, 4, 3), { length: 4, width: 3, height: 2 });
    expect(result.fits).toBe(true);
    expect(result.gaps).toEqual([]);
    expect(result.dimensions).toEqual({ length: 4, width: 3, height: 2 });
  });

  it('returns the per-axis overflow of the least-bad rotation', () => {
    const result = diagnoseFit(item(30, 2, 2), box);
    expect(result.fits).toBe(false);
    expect(result.gaps).toEqual([{ axis: '长', actual: 10, required: 30, over: 20 }]);
  });

  it('explains multiple axes when no rotation fits any way', () => {
    const result = diagnoseFit(item(20, 20, 20), box);
    expect(result.fits).toBe(false);
    expect(result.gaps.map((gap) => gap.axis).sort()).toEqual(['宽', '长', '高']);
  });
});
