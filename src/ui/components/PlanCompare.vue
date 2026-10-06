<script setup lang="ts">
import type { PackingPlan, PlanMode } from '../../core/models';
defineProps<{ plans: Record<PlanMode, PackingPlan>; selected: PlanMode }>();
const emit = defineEmits<{ select: [mode: PlanMode] }>();
</script>

<template>
  <div class="plan-tabs">
    <button v-for="plan in plans" :key="plan.id" type="button" :data-plan="plan.id" :class="{ active: plan.id === selected }" @click="emit('select', plan.id)">
      <span>{{ plan.id === 'minimal' ? 'LIGHT' : plan.id === 'comfort' ? 'BALANCED' : 'RESERVE' }}</span>
      <strong>{{ plan.name }}</strong>
      <small>{{ plan.placements.length }} 件 · {{ Math.round((plan.usedVolume / plan.volumeLimit) * 100) }}% 空间额度 · {{ plan.totalWeight.toFixed(1) }}/{{ plan.weightLimit.toFixed(1) }}kg</small>
    </button>
  </div>
</template>
