import { describe, expect, it } from 'vitest';
import { packItems, validateSuitcase } from '../packing-engine';
import type { PackingItem, Suitcase } from '../models';

const suitcase = (overrides: Partial<Suitcase> = {}): Suitcase => ({ length: 10, width: 8, height: 6, maxWeight: 10, ...overrides });
const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({
  id, name: id, category: '衣物', length: 3, width: 2, height: 1, weight: 1, priority: 2, mustHave: false, ...overrides,
});
const statuses = (plan: ReturnType<typeof packItems>, id: string) => {
  const entry = plan.unplaced.find((unplaced) => unplaced.item.id === id);
  if (!entry) throw new Error(`expected ${id} to be unplaced`);
  return { reason: entry.reason, map: new Map(entry.checks.map((check) => [check.key, check])) };
};

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

  it('returns deterministic coordinates and records every diagnostic check', () => {
    const inputs = [item('a'), item('huge', { length: 30 })];
    const first = packItems(suitcase(), inputs, 'comfort');
    expect(first).toEqual(packItems(suitcase(), inputs, 'comfort'));
    const { reason, map } = statuses(first, 'huge');
    expect(reason).toBe('物品尺寸超出箱体限制');
    expect(map.get('dimensions')?.status).toBe('fail');
    expect(map.get('dimensions')?.gaps).toBeDefined();
    expect(map.get('weight')?.status).toBe('pass');
    expect(map.get('volume')?.status).toBe('pass');
    expect(map.get('placement')?.status).toBe('skipped');
  });

  it('records both weight and volume failures for the same item with actual differences', () => {
    const heavyBig = item('heavy-big', { length: 8, width: 8, height: 5, weight: 9 });
    const filler = item('filler', { length: 8, width: 8, height: 5, weight: 2 });
    const plan = packItems(suitcase({ maxWeight: 3 }), [filler, heavyBig], 'comfort');
    const { map } = statuses(plan, 'heavy-big');
    expect(map.get('dimensions')?.status).toBe('pass');
    expect(map.get('weight')?.status).toBe('fail');
    expect(map.get('weight')?.shortfall).toBeCloseTo(8, 5);
    expect(map.get('volume')?.status).toBe('fail');
    expect(map.get('volume')?.shortfall).toBe(160);
    expect(map.get('placement')?.status).toBe('skipped');
  });

  it('keeps exploring weight after the user removes enough load under each plan quota', () => {
    const box = suitcase({ maxWeight: 10 });
    const heavy = item('heavy', { length: 2, width: 2, height: 2, weight: 9 });
    const comfort = packItems(box, [heavy], 'comfort');
    const shopping = packItems(box, [heavy], 'shopping');
    expect(comfort.placements).toHaveLength(1);
    const { map } = statuses(shopping, 'heavy');
    expect(map.get('weight')?.status).toBe('fail');
    expect(map.get('weight')?.shortfall).toBeCloseTo(2.5, 5);
    expect(map.get('weight')?.detail).toContain('购物版额度 6.5 kg');
  });

  it('reports volume shortfall against the 65% shopping reserve', () => {
    const bulky = item('bulky', { length: 9, width: 8, height: 5, weight: 1 });
    const plan = packItems(suitcase(), [bulky], 'shopping');
    const { reason, map } = statuses(plan, 'bulky');
    expect(reason).toBe('超出当前方案空间预留');
    expect(map.get('volume')?.status).toBe('fail');
    expect(map.get('volume')?.shortfall).toBe(Math.ceil(9 * 8 * 5 - 480 * 0.65));
  });

  it('distinguishes a current-arrangement miss from a physically impossible item', () => {
    const a = item('a', { length: 6, width: 5, height: 5, weight: 1 });
    const b = item('b', { length: 6, width: 5, height: 5, weight: 1 });
    const plan = packItems(suitcase({ maxWeight: 50 }), [a, b], 'comfort');
    expect(plan.placements).toHaveLength(1);
    const { reason, map } = statuses(plan, 'b');
    expect(reason).toBe('当前摆放未找到连续空位');
    expect(map.get('dimensions')?.status).toBe('pass');
    expect(map.get('weight')?.status).toBe('pass');
    expect(map.get('volume')?.status).toBe('pass');
    expect(map.get('placement')?.status).toBe('fail');
    expect(map.get('placement')?.detail).toContain('并不代表任何摆法都装不下');
  });

  it('explains the box limit first when no rotation fits even if quotas are also exceeded', () => {
    const impossible = item('impossible', { length: 20, width: 20, height: 20, weight: 30 });
    const plan = packItems(suitcase(), [impossible], 'comfort');
    const { reason, map } = statuses(plan, 'impossible');
    expect(reason).toBe('物品尺寸超出箱体限制');
    expect(map.get('dimensions')?.status).toBe('fail');
    expect(map.get('weight')?.status).toBe('fail');
  });

  it('flags invalid dimensions or weight without attempting placement', () => {
    const plan = packItems(suitcase(), [item('bad', { weight: 0 })], 'comfort');
    const { reason, map } = statuses(plan, 'bad');
    expect(reason).toBe('尺寸或重量无效');
    expect(map.get('valid')?.status).toBe('fail');
    expect(map.has('placement')).toBe(false);
  });
});
