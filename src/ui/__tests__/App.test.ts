import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from '../App.vue';
import { LocalPlannerRepository } from '../../adapters/local-planner.repository';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

function render() {
  let printCount = 0;
  const wrapper = mount(App, { props: {
    repository: new LocalPlannerRepository(new MemoryStorage()),
    printPort: { print: () => { printCount += 1; } },
  } });
  return { wrapper, getPrintCount: () => printCount };
}

function renderWithOversized() {
  const storage = new MemoryStorage();
  const snapshot = {
    suitcase: { length: 52, width: 35, height: 23, maxWeight: 10 },
    selectedPlan: 'comfort' as const,
    items: [
      { id: 'tent', name: '超长帐篷', category: '其他', length: 90, width: 30, height: 20, weight: 2, priority: 3, mustHave: true },
    ],
  };
  storage.setItem('c2c-004.planner', JSON.stringify(snapshot));
  let printCount = 0;
  const wrapper = mount(App, { props: {
    repository: new LocalPlannerRepository(storage),
    printPort: { print: () => { printCount += 1; } },
  } });
  return { wrapper, getPrintCount: () => printCount };
}

describe('Luggage planner App', () => {
  it('renders sample luggage and catches invalid dimensions', async () => {
    const { wrapper } = render();
    expect(wrapper.text()).toContain('行李箱空间规划师');
    expect(wrapper.text()).toContain('轻薄外套');
    await wrapper.get('[aria-label="行李箱长度"]').setValue('0');
    expect(wrapper.text()).toContain('行李箱长度必须大于 0');
  });

  it('adds and deletes an item', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="物品名称"]').setValue('新物品');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    expect(wrapper.text()).toContain('新物品');
    await wrapper.get('[aria-label="删除 新物品"]').trigger('click');
    expect(wrapper.text()).not.toContain('新物品');
  });

  it('selects a plan and highlights the same item in both projections', async () => {
    const { wrapper } = render();
    await wrapper.get('[data-plan="shopping"]').trigger('click');
    expect(wrapper.get('[data-plan="shopping"]').classes()).toContain('active');
    const jacket = wrapper.findAll('[data-item-id="jacket"]');
    expect(jacket.length).toBe(2);
    await jacket[0].trigger('click');
    expect(wrapper.findAll('[data-item-id="jacket"].selected')).toHaveLength(2);
  });

  it('delegates printing through the print port', async () => {
    const { wrapper, getPrintCount } = render();
    await wrapper.get('[data-testid="print-button"]').trigger('click');
    expect(getPrintCount()).toBe(1);
  });

  it('shows an expandable diagnosis for an item that cannot fit the box', async () => {
    const { wrapper } = renderWithOversized();
    const rows = wrapper.findAll('[data-testid="unplaced-row"]');
    const row = rows.find((candidate) => candidate.text().includes('超长帐篷'));
    expect(row).toBeTruthy();
    expect(row!.text()).toContain('物品尺寸超出箱体限制');

    await row!.find('summary').trigger('click');
    expect(row!.text()).toContain('任意旋转入箱');
    expect(row!.text()).toContain('任意旋转都无法放入箱体');
    expect(row!.text()).toContain('连续空位');
    expect(row!.find('button').exists()).toBe(false);

    const missingRisk = wrapper.findAll('.risk-row').find((risk) => risk.text().includes('必需品未装入：超长帐篷'));
    expect(missingRisk?.text()).toContain('物品尺寸超出箱体限制');
  });
});
