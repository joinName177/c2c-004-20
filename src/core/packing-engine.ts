import { diagnoseFit, intersects, rotationsOf } from './geometry';
import { itemVolume, suitcaseVolume, type PackingItem, type PackingPlan, type Placement, type PlanMode, type Suitcase, type UnplacedCheck } from './models';

const PLAN_NAMES: Record<PlanMode, string> = { minimal: '精简版', comfort: '舒适版', shopping: '购物版' };
const RESERVE: Record<PlanMode, number> = { minimal: 0.8, comfort: 1, shopping: 0.65 };

const CHECK_LABELS = {
  valid: '尺寸与重量有效',
  dimensions: '任意旋转入箱',
  weight: '当前剩余承重',
  volume: '当前空间预留',
  placement: '连续空位',
} as const;

/** 每条检查未通过时对应的首要原因（简短版）。 */
const SHORT_REASONS = {
  valid: '尺寸或重量无效',
  dimensions: '物品尺寸超出箱体限制',
  weight: '超出当前方案承重额度',
  volume: '超出当前方案空间预留',
  placement: '当前摆放未找到连续空位',
} as const;

function gapNumber(value: number): number {
  return Math.round(value * 100) / 100;
}

export function validateSuitcase(suitcase: Suitcase): string[] {
  const errors: string[] = [];
  if (!(suitcase.length > 0)) errors.push('行李箱长度必须大于 0');
  if (!(suitcase.width > 0)) errors.push('行李箱宽度必须大于 0');
  if (!(suitcase.height > 0)) errors.push('行李箱高度必须大于 0');
  if (!(suitcase.maxWeight > 0)) errors.push('承重必须大于 0');
  return errors;
}

function ordered(items: PackingItem[], mode: PlanMode): PackingItem[] {
  return [...items].sort((a, b) => {
    const required = Number(b.mustHave) - Number(a.mustHave);
    if (required) return required;
    const priority = b.priority - a.priority;
    if (priority) return priority;
    return mode === 'shopping' ? a.weight - b.weight : itemVolume(b) - itemVolume(a) || a.id.localeCompare(b.id);
  });
}

function candidatePoints(placements: Placement[]) {
  const points = [{ x: 0, y: 0, z: 0 }];
  for (const p of placements) {
    points.push(
      { x: p.x + p.dimensions.length, y: p.y, z: p.z },
      { x: p.x, y: p.y + p.dimensions.width, z: p.z },
      { x: p.x, y: p.y, z: p.z + p.dimensions.height },
    );
  }
  return points.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
}

function finalizeUnplaced(item: PackingItem, checks: UnplacedCheck[]): PackingPlan['unplaced'][number] {
  const failed = checks.find((check) => check.status === 'fail');
  return { item, reason: failed ? SHORT_REASONS[failed.key] : '未装入', checks };
}

export function packItems(suitcase: Suitcase, items: PackingItem[], mode: PlanMode): PackingPlan {
  const placements: Placement[] = [];
  const unplaced: PackingPlan['unplaced'] = [];
  const reserve = RESERVE[mode];
  const capacity = suitcaseVolume(suitcase) * reserve;
  const maxWeight = suitcase.maxWeight * reserve;
  let totalWeight = 0;
  let usedVolume = 0;

  for (const item of ordered(items, mode)) {
    if ([item.length, item.width, item.height, item.weight].some((value) => !(value > 0))) {
      unplaced.push({
        item,
        reason: SHORT_REASONS.valid,
        checks: [{ key: 'valid', label: CHECK_LABELS.valid, status: 'fail', detail: '物品的长宽高和重量都必须大于 0，请先修正后再装箱。' }],
      });
      continue;
    }

    const checks: UnplacedCheck[] = [{ key: 'valid', label: CHECK_LABELS.valid, status: 'pass', detail: '尺寸与重量数据有效。' }];

    const fit = diagnoseFit(item, suitcase);
    if (!fit.fits) {
      const gapText = fit.gaps.map((gap) => `${gap.axis}边需 ${gap.actual} cm，该摆向为 ${gap.required} cm，超出 ${gapNumber(gap.over)} cm`).join('；');
      checks.push({
        key: 'dimensions',
        label: CHECK_LABELS.dimensions,
        status: 'fail',
        detail: `任意旋转都无法放入箱体（越界最少的摆向为 ${fit.dimensions.length}×${fit.dimensions.width}×${fit.dimensions.height} cm）：${gapText}。这是箱体尺寸限制，需要更大的行李箱或更小的物品。`,
        gaps: fit.gaps,
      });
    } else {
      checks.push({
        key: 'dimensions',
        label: CHECK_LABELS.dimensions,
        status: 'pass',
        detail: `${fit.dimensions.length}×${fit.dimensions.width}×${fit.dimensions.height} cm 摆向下可以放入空箱。`,
      });
    }

    const weightLeft = maxWeight - totalWeight;
    const overweight = totalWeight + item.weight > maxWeight;
    if (overweight) {
      const over = item.weight - weightLeft;
      checks.push({
        key: 'weight',
        label: CHECK_LABELS.weight,
        status: 'fail',
        shortfall: gapNumber(over),
        detail: `物品重 ${item.weight} kg，本方案当前仅剩 ${gapNumber(weightLeft)} kg 承重额度（${PLAN_NAMES[mode]}额度 ${maxWeight} kg），超出 ${gapNumber(over)} kg。`,
      });
    } else {
      checks.push({
        key: 'weight',
        label: CHECK_LABELS.weight,
        status: 'pass',
        detail: `承重额度 ${maxWeight} kg，当前剩余 ${gapNumber(weightLeft)} kg，物品重 ${item.weight} kg。`,
      });
    }

    const volumeLeft = capacity - usedVolume;
    const volume = itemVolume(item);
    const overVolume = usedVolume + volume > capacity;
    if (overVolume) {
      const over = volume - volumeLeft;
      checks.push({
        key: 'volume',
        label: CHECK_LABELS.volume,
        status: 'fail',
        shortfall: Math.ceil(over),
        detail: `物品体积 ${(volume / 1000).toFixed(2)} L，本方案当前仅剩 ${(Math.max(volumeLeft, 0) / 1000).toFixed(2)} L 空间额度（${PLAN_NAMES[mode]}按 ${Math.round(reserve * 100)}% 预留），还差 ${(over / 1000).toFixed(2)} L。`,
      });
    } else {
      checks.push({
        key: 'volume',
        label: CHECK_LABELS.volume,
        status: 'pass',
        detail: `空间额度 ${(capacity / 1000).toFixed(2)} L，当前剩余 ${(volumeLeft / 1000).toFixed(2)} L，物品占 ${(volume / 1000).toFixed(2)} L。`,
      });
    }

    if (!fit.fits || overweight || overVolume) {
      checks.push({
        key: 'placement',
        label: CHECK_LABELS.placement,
        status: 'skipped',
        detail: fit.fits
          ? '受上述承重或空间额度限制，未尝试在当前摆放中寻找位置。'
          : '物品本身无法放入箱体，不再检查摆放空位。',
      });
      unplaced.push(finalizeUnplaced(item, checks));
      continue;
    }

    let placement: Placement | undefined;
    for (const point of candidatePoints(placements)) {
      for (const dimensions of rotationsOf(item)) {
        const candidate: Placement = { itemId: item.id, ...point, dimensions };
        const inBounds = candidate.x + dimensions.length <= suitcase.length
          && candidate.y + dimensions.width <= suitcase.width
          && candidate.z + dimensions.height <= suitcase.height;
        if (inBounds && placements.every((placed) => !intersects(candidate, placed))) {
          placement = candidate;
          break;
        }
      }
      if (placement) break;
    }

    if (!placement) {
      checks.push({
        key: 'placement',
        label: CHECK_LABELS.placement,
        status: 'fail',
        detail: `物品可装入空箱，承重与空间额度也足够（剩余空间 ${(volumeLeft / 1000).toFixed(2)} L、剩余承重 ${gapNumber(weightLeft)} kg），但当前摆放没有为它找到连续空位。这只说明本次摆放方案没排下，并不代表任何摆法都装不下，调整已装物品的位置或换一种装箱顺序后可能装入。`,
      });
      unplaced.push(finalizeUnplaced(item, checks));
      continue;
    }
    placements.push(placement);
    totalWeight += item.weight;
    usedVolume += volume;
  }

  return {
    id: mode,
    name: PLAN_NAMES[mode],
    placements,
    unplaced,
    totalWeight,
    usedVolume,
    capacityRatio: suitcaseVolume(suitcase) ? usedVolume / suitcaseVolume(suitcase) : 0,
  };
}
