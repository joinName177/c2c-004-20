import { describe, expect, it } from 'vitest';
import { detectRisks } from '../risk-engine';
import type { PackingItem, PackingPlan, Suitcase } from '../models';

const suitcase: Suitcase = { length: 10, width: 8, height: 6, maxWeight: 10 };
const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({ id, name: id, category: '其他', length: 2, width: 2, height: 2, weight: 1, priority: 2, mustHave: false, ...overrides });
const basePlan = (): PackingPlan => ({
  id: 'comfort',
  name: '舒适版',
  placements: [],
  unplaced: [],
  totalWeight: 0,
  usedVolume: 0,
  weightLimit: 10,
  volumeLimit: 480,
  capacityRatio: 0,
});

describe('detectRisks', () => {
  it('reports overweight and high volume', () => {
    const plan = { ...basePlan(), totalWeight: 11, usedVolume: 460, capacityRatio: 0.96 };
    expect(detectRisks(plan, suitcase, []).map((risk) => risk.id)).toEqual(expect.arrayContaining(['overweight', 'high-volume']));
  });

  it('reports an oversized unplaced item using the item diagnostic detail', () => {
    const huge = item('huge', { length: 11, name: '长杆' });
    const plan = {
      ...basePlan(),
      unplaced: [{
        item: huge,
        reason: '箱体尺寸不足（任意旋转）',
        diagnostics: [{ code: 'dimensions' as const, message: '单件在任意旋转下都无法放入箱体：长边需 11.0cm，箱体对应边仅 10.0cm，超出 1.0cm' }],
      }],
    };
    const risks = detectRisks(plan, suitcase, [huge]);
    expect(risks).toContainEqual(expect.objectContaining({ id: 'oversized-huge', diagnostic: true }));
    expect(risks.find((risk) => risk.id === 'oversized-huge')?.message).toContain('超出 1.0cm');
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

  it('marks an omitted must-have item as critical and links it to the same diagnostic item', () => {
    const required = item('passport', { mustHave: true, name: '证件包' });
    const plan = {
      ...basePlan(),
      unplaced: [{
        item: required,
        reason: '当前摆放未找到连续空位',
        diagnostics: [{ code: 'placement' as const, message: '体积预留足够，但当前摆放没有找到可容纳它的连续空位' }],
      }],
    };
    const risk = detectRisks(plan, suitcase, [required]).find(({ id }) => id === 'missing-passport');
    expect(risk).toMatchObject({ severity: 'critical', itemId: 'passport', diagnostic: true });
    expect(risk?.message).toContain('证件包');
    expect(risk?.message).toContain('原因详情');
  });
});
