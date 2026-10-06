<script setup lang="ts">
import type { Risk } from '../../core/models';
defineProps<{ risks: Risk[] }>();
const emit = defineEmits<{ inspectItem: [itemId: string] }>();
</script>

<template><aside class="risk-panel"><div class="section-title"><div><span>RISK SCAN</span><h2>装箱风险</h2></div><b>{{ risks.filter(r => r.severity !== 'info').length }}</b></div><article v-for="risk in risks" :key="risk.id" :class="['risk-row', risk.severity]"><i>{{ risk.severity === 'critical' ? '!' : risk.severity === 'warning' ? '△' : '✓' }}</i><div><strong>{{ risk.title }}</strong><p>{{ risk.message }}</p><button v-if="risk.itemId && risk.diagnostic" type="button" class="risk-link" :data-testid="`risk-link-${risk.itemId}`" :data-item-id="risk.itemId" @click="emit('inspectItem', risk.itemId)">查看原因详情</button></div></article></aside></template>
