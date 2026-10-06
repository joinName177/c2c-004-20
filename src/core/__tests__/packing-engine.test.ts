import { describe, expect, it } from 'vitest';
import { packItems, validateSuitcase } from '../packing-engine';
import type { PackingItem, Suitcase } from '../models';

const suitcase = (overrides: Partial<Suitcase> = {}): Suitcase => ({ length: 10, width: 8, height: 6, maxWeight: 10, ...overrides });
const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({
  id, name: id, category: '衣物', length: 3, width: 2, height: 1, weight: 1, priority: 2, mustHave: false, ...overrides,
});

describe('validateSuitcase', () => {
  it('rejects each non-positive capacity', () => {
    expect(validateSuitcase(suitcase({ height: 0 }))).toContain('行李箱高度必须大于 0');
    expect(validateSuitcase(suitcase({ maxWeight: -1 }))).toContain('承重必须大于 0');
  });
});

describe('packItems', () => {
  it('allows total weight exactly at the suitcase limit', () => {
    const plan = packItems(suitcase({ maxWeight: 2 }), [item('a'), item('b')], 'comfort');
    expect(plan.placements).toHaveLength(2);
    expect(plan.totalWeight).toBe(2);
  });

  it('uses rotation when the original orientation does not fit', () => {
    const plan = packItems(suitcase({ length: 4, width: 3, height: 2 }), [item('rotated', { length: 2, width: 4, height: 3 })], 'comfort');
    expect(plan.placements[0]?.dimensions).toEqual({ length: 4, width: 3, height: 2 });
  });

  it('keeps placements inside bounds and non-overlapping', () => {
    const plan = packItems(suitcase(), [item('a'), item('b'), item('c')], 'comfort');
    expect(plan.placements.every((p) => p.x + p.dimensions.length <= 10 && p.y + p.dimensions.width <= 8 && p.z + p.dimensions.height <= 6)).toBe(true);
    expect(new Set(plan.placements.map((p) => `${p.x}:${p.y}:${p.z}`)).size).toBe(3);
  });

  it('returns deterministic coordinates and an unplaced reason', () => {
    const inputs = [item('a'), item('huge', { length: 30 })];
    const plan = packItems(suitcase(), inputs, 'comfort');
    expect(packItems(suitcase(), inputs, 'comfort')).toEqual(plan);
    expect(plan.unplaced[0]?.reason).toContain('箱体尺寸');
  });

  it('keeps all currently applicable diagnostics with their deficits', () => {
    const plan = packItems(
      suitcase({ length: 12, width: 12, height: 12, maxWeight: 0 }),
      [item('heavy-long', { length: 20, weight: 2 })],
      'comfort',
    );
    const codes = plan.unplaced[0]?.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toEqual(['dimensions', 'weight']);
    const [dimensions, weight] = plan.unplaced[0]?.diagnostics ?? [];
    expect(dimensions?.deficit).toBe(8);
    expect(weight?.deficit).toBe(2);
    expect(weight?.remaining).toBe(0);
  });

  it('describes a placement miss as current packing state instead of a general impossibility', () => {
    const blocker = item('blocker', { length: 6, width: 6, height: 1, mustHave: true });
    const candidate = item('candidate', { length: 6, width: 6, height: 1, weight: 0.1 });
    const plan = packItems(suitcase({ length: 11, width: 11, height: 1, maxWeight: 10 }), [blocker, candidate], 'shopping');
    const diagnostic = plan.unplaced[0]?.diagnostics[0];
    expect(diagnostic?.code).toBe('placement');
    expect(diagnostic?.message).toContain('当前摆放没有找到');
    expect(diagnostic?.message).toContain('不能断言所有摆法都无解');
  });

  it('keeps volume reservation and placement diagnostics when both are true', () => {
    const blocker = item('blocker', { length: 6, width: 6, height: 1, mustHave: true });
    const candidate = item('candidate', { length: 6, width: 6, height: 1, weight: 0.1 });
    const plan = packItems(suitcase({ length: 10, width: 10, height: 1, maxWeight: 10 }), [blocker, candidate], 'shopping');
    expect(plan.unplaced[0]?.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['volume', 'placement']);
  });

  it('calculates weight and volume deficits using the selected plan quota', () => {
    const heavy = item('heavy', { length: 1, width: 1, height: 1, weight: 9 });
    const comfort = packItems(suitcase({ maxWeight: 10 }), [heavy], 'comfort');
    const minimal = packItems(suitcase({ maxWeight: 10 }), [heavy], 'minimal');
    expect(comfort.unplaced).toHaveLength(0);
    expect(minimal.unplaced[0]?.diagnostics.find((diagnostic) => diagnostic.code === 'weight')?.deficit).toBeCloseTo(1);
    expect(minimal.weightLimit).toBeCloseTo(8);
  });
});
