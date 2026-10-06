import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import UnplacedPanel from '../components/UnplacedPanel.vue';
import PrintSheet from '../components/PrintSheet.vue';
import { packItems } from '../../core/packing-engine';
import type { PackingItem, PackingPlan, Risk, Suitcase } from '../../core/models';

const small: Suitcase = { length: 10, width: 8, height: 6, maxWeight: 3 };
const suitcase: Suitcase = { length: 10, width: 8, height: 6, maxWeight: 20 };
const mk = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({ id, name: id, category: '其他', length: 2, width: 2, height: 2, weight: 1, priority: 2, mustHave: false, ...overrides });

describe('UnplacedPanel', () => {
  it('renders nothing when every item is placed', () => {
    const plan = packItems(suitcase, [mk('a')], 'comfort');
    const wrapper = mount(UnplacedPanel, { props: { unplaced: plan.unplaced } });
    expect(wrapper.find('[data-testid="unplaced-panel"]').exists()).toBe(false);
  });

  it('shows the primary reason and expands to reveal each check and difference', () => {
    const fillers = Array.from({ length: 3 }, (_, index) => mk(`f${index}`, { length: 2, width: 2, height: 2, weight: 1, priority: 3 }));
    const failed = packItems(small, [...fillers, mk('zz-heavy', { name: 'heavy', weight: 1 })], 'comfort');
    const heavy = failed.unplaced.find((entry) => entry.item.id === 'zz-heavy');
    expect(heavy).toBeDefined();
    const wrapper = mount(UnplacedPanel, { props: { unplaced: failed.unplaced } });
    const row = wrapper.findAll('[data-testid="unplaced-row"]').find((candidate) => candidate.text().includes('heavy'))!;
    expect(row.text()).toContain('超出当前方案承重额度');
    expect(row.text()).toContain('当前剩余承重');
    expect(row.text()).toContain('超出 1 kg');
    expect(row.text()).toContain('未尝试在当前摆放中寻找位置');
  });

  it('marks must-have items but never offers to delete them', () => {
    const plan = packItems(suitcase, [mk('required', { mustHave: true, length: 30 })], 'comfort');
    expect(plan.unplaced).toHaveLength(1);
    const wrapper = mount(UnplacedPanel, { props: { unplaced: plan.unplaced } });
    expect(wrapper.text()).toContain('★ required');
    expect(wrapper.find('button').exists()).toBe(false);
  });
});

describe('PrintSheet unplaced reasons', () => {
  it('prints the same item and reason as the diagnosis panel', () => {
    const items: PackingItem[] = [mk('a'), mk('heavy', { mustHave: true, weight: 99 })];
    const plan: PackingPlan = packItems(suitcase, items, 'comfort');
    expect(plan.unplaced[0]!.item.id).toBe('heavy');
    const risks: Risk[] = [{ id: 'missing-heavy', severity: 'critical', title: '必需品未装入：heavy', message: `未装入原因：${plan.unplaced[0]!.reason}。`, itemId: 'heavy' }];
    const wrapper = mount(PrintSheet, { props: { suitcase, items, plan, risks } });
    expect(wrapper.text()).toContain('heavy');
    expect(wrapper.text()).toContain(plan.unplaced[0]!.reason);
    expect(wrapper.text()).toContain('未装入原因：超出当前方案承重额度');
  });
});
