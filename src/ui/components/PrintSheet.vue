<script setup lang="ts">
import type { PackingItem, PackingPlan, Risk, Suitcase } from '../../core/models';
defineProps<{ suitcase: Suitcase; items: PackingItem[]; plan: PackingPlan; risks: Risk[] }>();
</script>

<template><section class="print-sheet"><h1>行李箱空间规划单</h1><p>{{ suitcase.length }} × {{ suitcase.width }} × {{ suitcase.height }} cm · 限重 {{ suitcase.maxWeight }} kg</p><h2>{{ plan.name }}</h2><ol><li v-for="item in items" :key="item.id">{{ plan.placements.some(p => p.itemId === item.id) ? '□' : '×' }} {{ item.name }} — {{ item.weight }} kg</li></ol><template v-if="plan.unplaced.length"><h3>未装入原因</h3><p v-for="entry in plan.unplaced" :key="entry.item.id">× {{ entry.item.name }}（{{ entry.item.length }}×{{ entry.item.width }}×{{ entry.item.height }} cm · {{ entry.item.weight }} kg）：{{ entry.reason }}<template v-for="check in entry.checks.filter(c => c.status === 'fail')" :key="check.key"><br>　– {{ check.label }}：{{ check.detail }}</template></p></template><h3>风险提示</h3><p v-for="risk in risks" :key="risk.id">{{ risk.title }}：{{ risk.message }}</p></section></template>
