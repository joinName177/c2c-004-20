<script setup lang="ts">
import { formatMeasure, type PackingPlan } from '../../core/models';

const props = defineProps<{ plan: PackingPlan; openItemId?: string }>();
const emit = defineEmits<{ toggle: [itemId: string] }>();

function liters(value: number): string {
  return formatMeasure(value / 1000, 2);
}

function diagnosticText(message: string): string {
  return message.replace(/(\d+(?:\.\d+)?)cm³/g, (_match, value: string) => `${liters(Number(value))}L`);
}

function onToggle(itemId: string, event: Event) {
  const details = event.currentTarget as HTMLDetailsElement;
  if (!details.open) emit('toggle', itemId);
}
</script>

<template>
  <section class="unplaced-panel" data-testid="unplaced-diagnostics">
    <div class="unplaced-head">
      <div>
        <span>UNPLACED DIAGNOSTICS</span>
        <h3>未装入原因详情</h3>
      </div>
      <b>{{ props.plan.unplaced.length }} 件</b>
    </div>
    <p v-if="!props.plan.unplaced.length" class="unplaced-empty">当前方案没有未装入物品。</p>
    <details
      v-for="entry in props.plan.unplaced"
      :id="`unplaced-${entry.item.id}`"
      :key="entry.item.id"
      class="unplaced-item"
      :data-item-id="entry.item.id"
      :open="props.openItemId === entry.item.id || undefined"
      @toggle="onToggle(entry.item.id, $event)"
    >
      <summary>
        <span class="unplaced-name">{{ entry.item.name }}</span>
        <em v-if="entry.item.mustHave">必带</em>
        <small>{{ entry.reason }}</small>
      </summary>
      <ul>
        <li v-for="(diagnostic, index) in entry.diagnostics" :key="`${diagnostic.code}-${index}`">
          {{ diagnosticText(diagnostic.message) }}
        </li>
      </ul>
    </details>
  </section>
</template>
