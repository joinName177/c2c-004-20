import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PrintSheet from '../PrintSheet.vue';
import type { PackingItem, PackingPlan, Suitcase } from '../../../core/models';

const suitcase: Suitcase = { length: 50, width: 30, height: 20, maxWeight: 10 };
const item: PackingItem = {
  id: 'docs',
  name: '证件包',
  category: '随身',
  length: 20,
  width: 15,
  height: 5,
  weight: 1,
  priority: 3,
  mustHave: true,
};
const plan: PackingPlan = {
  id: 'minimal',
  name: '精简版',
  placements: [],
  unplaced: [{
    item,
    reason: '当前方案承重预留不足',
    diagnostics: [{ code: 'weight', message: '当前方案剩余承重 0.0kg，该件还需要 1.0kg，差额 1.0kg', deficit: 1, remaining: 0 }],
  }],
  totalWeight: 8,
  usedVolume: 24000,
  weightLimit: 8,
  volumeLimit: 24000,
  capacityRatio: 0.8,
};

describe('PrintSheet', () => {
  it('keeps the inventory, omission reason and risk notice attached to the same item', () => {
    const risks = [{
      id: 'missing-docs',
      severity: 'critical' as const,
      title: '必需品未装入：证件包',
      message: '“证件包”在当前方案未装入：当前方案承重预留不足。请查看该物品的原因详情。',
      itemId: 'docs',
      diagnostic: true,
    }];
    const wrapper = mount(PrintSheet, { props: { suitcase, items: [item], plan, risks } });
    const references = wrapper.findAll('[data-item-id="docs"]');
    expect(references).toHaveLength(3);
    expect(wrapper.text()).toContain('证件包（必带）');
    expect(wrapper.text()).toContain('当前方案承重预留不足');
    expect(wrapper.text()).toContain('差额 1.0kg');
  });
});
