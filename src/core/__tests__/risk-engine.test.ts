import { describe, expect, it } from 'vitest';
import { detectRisks } from '../risk-engine';
import { packItems } from '../packing-engine';
import type { PackingItem, PackingPlan, Suitcase, UnplacedCheck } from '../models';

const suitcase: Suitcase = { length: 10, width: 8, height: 6, maxWeight: 10 };
const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({ id, name: id, category: '其他', length: 2, width: 2, height: 2, weight: 1, priority: 2, mustHave: false, ...overrides });
const basePlan = (): PackingPlan => ({ id: 'comfort', name: '舒适版', placements: [], unplaced: [], totalWeight: 0, usedVolume: 0, capacityRatio: 0 });

describe('detectRisks', () => {
  it('reports overweight and high volume', () => {
    const plan = { ...basePlan(), totalWeight: 11, usedVolume: 460, capacityRatio: 0.96 };
    expect(detectRisks(plan, suitcase, []).map((risk) => risk.id)).toEqual(expect.arrayContaining(['overweight', 'high-volume']));
  });

  it('reports an oversized unplaced item', () => {
    const huge = item('huge', { length: 11 });
    const checks: UnplacedCheck[] = [{ key: 'dimensions', label: '任意旋转入箱', status: 'fail', detail: '越界' }];
    const plan = { ...basePlan(), unplaced: [{ item: huge, reason: '物品尺寸超出箱体限制', checks }] };
    expect(detectRisks(plan, suitcase, [huge]).some((risk) => risk.id === 'oversized-huge')).toBe(true);
  });

  it('reports fragile items with a box stacked above', () => {
    const glass = item('glass', { fragile: true });
    const top = item('top');
    const plan = { ...basePlan(), placements: [
      { itemId: 'glass', x: 0, y: 0, z: 0, dimensions: { length: 2, width: 2, height: 2 } },
      { itemId: 'top', x: 0, y: 0, z: 2, dimensions: { length: 2, width: 2, height: 2 } },
    ] };
    expect(detectRisks(plan, suitcase, [glass, top]).some((risk) => risk.id === 'fragile-glass')).toBe(true);
  });

  it('reports heavy items placed high', () => {
    const heavy = item('heavy', { weight: 4 });
    const plan = { ...basePlan(), placements: [{ itemId: 'heavy', x: 0, y: 0, z: 4, dimensions: { length: 2, width: 2, height: 2 } }] };
    expect(detectRisks(plan, suitcase, [heavy]).some((risk) => risk.id === 'high-heavy')).toBe(true);
  });

  it('marks an omitted must-have item as critical and quotes its actual reason', () => {
    const required = item('passport', { mustHave: true, length: 12 });
    const plan = packItems(suitcase, [required], 'comfort');
    const risks = detectRisks(plan, suitcase, [required]);
    const missing = risks.find((risk) => risk.id === 'missing-passport');
    expect(missing).toMatchObject({ severity: 'critical', itemId: 'passport' });
    expect(missing?.message).toContain(plan.unplaced[0]!.reason);
  });

  it('describes a placement-only failure as arrangement, not an impossible item', () => {
    const box: Suitcase = { length: 10, width: 8, height: 6, maxWeight: 50 };
    const a = item('a', { name: '收纳箱A', length: 6, width: 5, height: 5, weight: 1 });
    const b = item('b', { name: '收纳箱B', length: 6, width: 5, height: 5, weight: 1 });
    const plan = packItems(box, [a, b], 'comfort');
    const risks = detectRisks(plan, box, [a, b]);
    expect(risks.some((risk) => risk.id === 'oversized-b')).toBe(false);
    const check = plan.unplaced[0]!.checks.find((c) => c.key === 'placement');
    expect(check?.status).toBe('fail');
    expect(check?.detail).toContain('当前摆放');
  });
});
