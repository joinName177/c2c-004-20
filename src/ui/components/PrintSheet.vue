<script setup lang="ts">
import { formatMeasure, type PackingItem, type PackingPlan, type Risk, type Suitcase } from '../../core/models';

const props = defineProps<{ suitcase: Suitcase; items: PackingItem[]; plan: PackingPlan; risks: Risk[] }>();

const placedIds = new Set(props.plan.placements.map((placement) => placement.itemId));

function liters(value: number): string {
  return formatMeasure(value / 1000, 2);
}

function diagnosticText(message: string): string {
  return message.replace(/(\d+(?:\.\d+)?)cm³/g, (_match, value: string) => `${liters(Number(value))}L`);
}
</script>

<template>
  <section class="print-sheet">
    <h1>行李箱空间规划单</h1>
    <p>{{ suitcase.length }} × {{ suitcase.width }} × {{ suitcase.height }} cm · 方案限重 {{ formatMeasure(plan.weightLimit) }} / {{ suitcase.maxWeight }} kg</p>
    <h2>{{ plan.name }}</h2>
    <ol>
      <li v-for="item in items" :key="item.id" :data-item-id="item.id">
        {{ placedIds.has(item.id) ? '□ 已装' : '× 未装' }} {{ item.name }}<em v-if="item.mustHave">（必带）</em> — {{ item.weight }} kg
      </li>
    </ol>
    <h3>未装入原因详情</h3>
    <p v-if="!plan.unplaced.length">无未装入物品。</p>
    <ul class="print-unplaced-list">
      <li v-for="entry in plan.unplaced" :key="entry.item.id" :data-item-id="entry.item.id" :data-must-have="entry.item.mustHave">
        <strong>{{ entry.item.name }}<em v-if="entry.item.mustHave">（必带）</em>：{{ entry.reason }}</strong>
        <span v-for="(diagnostic, index) in entry.diagnostics" :key="diagnostic.code">原因 {{ index + 1 }}：{{ diagnosticText(diagnostic.message) }}</span>
      </li>
    </ul>
    <h3>风险提示</h3>
    <p v-for="risk in risks" :key="risk.id" :data-item-id="risk.itemId">{{ risk.title }}：{{ risk.message }}</p>
  </section>
</template>
