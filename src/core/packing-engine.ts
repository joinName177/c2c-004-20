import { intersects, rotationsOf } from './geometry';
import { formatMeasure, itemVolume, suitcaseVolume, type Dimensions, type PackingItem, type PackingPlan, type Placement, type PlanMode, type Suitcase, type UnplacedDimensionDeficit, type UnplacedItem, type UnplacedReason } from './models';

const PLAN_NAMES: Record<PlanMode, string> = { minimal: '精简版', comfort: '舒适版', shopping: '购物版' };
export const RESERVE: Record<PlanMode, number> = { minimal: 0.8, comfort: 1, shopping: 0.65 };
const EPSILON = 1e-9;

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

function isValidItem(item: PackingItem): boolean {
  return [item.length, item.width, item.height, item.weight].every((value) => Number.isFinite(value) && value > 0);
}

function dimensionDeficits(item: PackingItem, suitcase: Suitcase): UnplacedDimensionDeficit[] {
  const itemAxes = [
    { axis: 'length' as const, value: item.length },
    { axis: 'width' as const, value: item.width },
    { axis: 'height' as const, value: item.height },
  ].sort((a, b) => b.value - a.value);
  const boxAxes = [
    { axis: 'length' as const, value: suitcase.length },
    { axis: 'width' as const, value: suitcase.width },
    { axis: 'height' as const, value: suitcase.height },
  ].sort((a, b) => b.value - a.value);

  return itemAxes.flatMap((itemAxis, index) => {
    const available = boxAxes[index].value;
    if (itemAxis.value <= available + EPSILON) return [];
    return [{ itemAxis: itemAxis.axis, required: itemAxis.value, available, deficit: itemAxis.value - available }];
  });
}

function dimensionsReason(deficits: UnplacedDimensionDeficit[]): UnplacedReason {
  const detail = deficits
    .map(({ itemAxis, required, available, deficit }) => {
      const axisName = itemAxis === 'length' ? '长' : itemAxis === 'width' ? '宽' : '高';
      return `${axisName}边需 ${formatMeasure(required)}cm，箱体对应边仅 ${formatMeasure(available)}cm，超出 ${formatMeasure(deficit)}cm`;
    })
    .join('；');
  return {
    code: 'dimensions',
    message: `单件在任意旋转下都无法放入箱体：${detail}`,
    deficit: Math.max(...deficits.map(({ deficit }) => deficit)),
    dimensions: deficits,
  };
}

function weightReason(item: PackingItem, totalWeight: number, weightLimit: number): UnplacedReason {
  const remaining = weightLimit - totalWeight;
  const deficit = item.weight - remaining;
  return {
    code: 'weight',
    message: `当前方案剩余承重 ${formatMeasure(Math.max(remaining, 0))}kg，该件还需要 ${formatMeasure(item.weight)}kg，差额 ${formatMeasure(deficit)}kg`,
    deficit,
    remaining,
  };
}

function volumeReason(item: Dimensions, usedVolume: number, volumeLimit: number): UnplacedReason {
  const volume = itemVolume(item);
  const remaining = volumeLimit - usedVolume;
  const deficit = volume - remaining;
  return {
    code: 'volume',
    message: `当前方案剩余预留空间 ${formatMeasure(Math.max(remaining, 0))}cm³，该件体积 ${formatMeasure(volume)}cm³，差额 ${formatMeasure(deficit)}cm³`,
    deficit,
    remaining,
  };
}

function placementReason(): UnplacedReason {
  return {
    code: 'placement',
    message: '体积预留足够，但当前摆放没有找到可容纳它的连续空位；这只表示本次启发式摆放未找到位置，不能断言所有摆法都无解',
  };
}

function summarizeDiagnostics(diagnostics: UnplacedReason[]): string {
  const labels: Record<UnplacedReason['code'], string> = {
    invalid: '尺寸或重量无效',
    dimensions: '箱体尺寸不足（任意旋转）',
    weight: '当前方案承重预留不足',
    volume: '当前方案空间预留不足',
    placement: '当前摆放未找到连续空位',
  };
  return diagnostics.map((diagnostic) => labels[diagnostic.code]).join('；');
}

function findPlacement(item: PackingItem, suitcase: Suitcase, placements: Placement[]): Placement | undefined {
  for (const point of candidatePoints(placements)) {
    for (const dimensions of rotationsOf(item)) {
      const candidate: Placement = { itemId: item.id, ...point, dimensions };
      const inBounds = candidate.x + dimensions.length <= suitcase.length + EPSILON
        && candidate.y + dimensions.width <= suitcase.width + EPSILON
        && candidate.z + dimensions.height <= suitcase.height + EPSILON;
      if (inBounds && placements.every((placed) => !intersects(candidate, placed))) return candidate;
    }
  }
  return undefined;
}

export function packItems(suitcase: Suitcase, items: PackingItem[], mode: PlanMode): PackingPlan {
  const placements: Placement[] = [];
  const unplaced: UnplacedItem[] = [];
  const volumeLimit = suitcaseVolume(suitcase) * RESERVE[mode];
  const weightLimit = suitcase.maxWeight * RESERVE[mode];
  let totalWeight = 0;
  let usedVolume = 0;

  for (const item of ordered(items, mode)) {
    if (!isValidItem(item)) {
      const diagnostics: UnplacedReason[] = [{ code: 'invalid', message: '尺寸或重量必须为大于 0 的有效数字' }];
      unplaced.push({ item, reason: summarizeDiagnostics(diagnostics), diagnostics });
      continue;
    }

    const diagnostics: UnplacedReason[] = [];
    const deficits = dimensionDeficits(item, suitcase);
    const cannotFitInBox = deficits.length > 0;
    if (cannotFitInBox) diagnostics.push(dimensionsReason(deficits));
    if (totalWeight + item.weight > weightLimit + EPSILON) diagnostics.push(weightReason(item, totalWeight, weightLimit));
    if (usedVolume + itemVolume(item) > volumeLimit + EPSILON) diagnostics.push(volumeReason(item, usedVolume, volumeLimit));

    const placement = cannotFitInBox
      ? undefined
      : findPlacement(item, suitcase, placements);

    if (!placement && !cannotFitInBox) {
      diagnostics.push(placementReason());
    }

    if (diagnostics.length) {
      unplaced.push({ item, reason: summarizeDiagnostics(diagnostics), diagnostics });
      continue;
    }
    if (!placement) throw new Error('Unexpected packing diagnostic state');

    placements.push(placement);
    totalWeight += item.weight;
    usedVolume += itemVolume(item);
  }

  return {
    id: mode,
    name: PLAN_NAMES[mode],
    placements,
    unplaced,
    totalWeight,
    usedVolume,
    weightLimit,
    volumeLimit,
    capacityRatio: suitcaseVolume(suitcase) ? usedVolume / suitcaseVolume(suitcase) : 0,
  };
}
