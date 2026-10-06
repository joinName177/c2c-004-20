<script setup lang="ts">
import type { UnplacedDiagnosis } from '../../core/models';

defineProps<{ unplaced: UnplacedDiagnosis[] }>();

const statusMark = { pass: '✓', fail: '!', skipped: '–' } as const;
</script>

<template>
  <section v-if="unplaced.length" class="panel unplaced-panel" data-testid="unplaced-panel">
    <div class="section-title">
      <div><span>UNPACKED DIAGNOSIS</span><h2>未装入物品诊断</h2></div>
      <b>{{ unplaced.length }} 件</b>
    </div>
    <p class="unplaced-hint">诊断只解释当前方案的计算结果，不会自动移除任何物品；展开可查看各项检查与对应差额。</p>
    <details v-for="entry in unplaced" :key="entry.item.id" class="unplaced-row" data-testid="unplaced-row">
      <summary>
        <span class="unplaced-name">{{ entry.item.mustHave ? '★ ' : '' }}{{ entry.item.name }}</span>
        <span class="unplaced-reason" :data-item-id="entry.item.id">{{ entry.reason }}</span>
      </summary>
      <div class="unplaced-meta">{{ entry.item.length }}×{{ entry.item.width }}×{{ entry.item.height }} cm · {{ entry.item.weight }} kg · P{{ entry.item.priority }}</div>
      <ul class="check-list">
        <li v-for="check in entry.checks" :key="check.key" :class="['check-row', check.status]">
          <i>{{ statusMark[check.status] }}</i>
          <div>
            <strong>{{ check.label }}</strong>
            <p>{{ check.detail }}</p>
          </div>
        </li>
      </ul>
    </details>
  </section>
</template>
