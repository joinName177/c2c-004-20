import type { DimensionGap, Dimensions, PackingItem, Placement } from './models';

export function rotationsOf(item: Pick<PackingItem, 'length' | 'width' | 'height'>): Dimensions[] {
  const [a, b, c] = [item.length, item.width, item.height];
  const candidates: Dimensions[] = [
    { length: a, width: b, height: c }, { length: a, width: c, height: b },
    { length: b, width: a, height: c }, { length: b, width: c, height: a },
    { length: c, width: a, height: b }, { length: c, width: b, height: a },
  ];
  return candidates.filter((value, index) => candidates.findIndex((candidate) =>
    candidate.length === value.length && candidate.width === value.width && candidate.height === value.height,
  ) === index);
}

export function intersects(a: Placement, b: Placement): boolean {
  return a.x < b.x + b.dimensions.length && a.x + a.dimensions.length > b.x
    && a.y < b.y + b.dimensions.width && a.y + a.dimensions.width > b.y
    && a.z < b.z + b.dimensions.height && a.z + a.dimensions.height > b.z;
}

export interface FitDiagnosis {
  fits: boolean;
  /** 越界最少的摆向；fits 为 true 时是首个可放入的摆向。 */
  dimensions: Dimensions;
  gaps: DimensionGap[];
}

/**
 * 判断物品在任意轴向旋转下能否放入空箱：只要有一种旋转的三条边都不超过
 * 箱体对应内边即可。返回越界最少的摆向及各轴差额，用于解释箱体限制。
 */
export function diagnoseFit(item: Pick<PackingItem, 'length' | 'width' | 'height'>, box: Dimensions): FitDiagnosis {
  let best: FitDiagnosis | undefined;
  for (const dimensions of rotationsOf(item)) {
    const axes = [
      { axis: '长' as const, actual: box.length, required: dimensions.length, over: dimensions.length - box.length },
      { axis: '宽' as const, actual: box.width, required: dimensions.width, over: dimensions.width - box.width },
      { axis: '高' as const, actual: box.height, required: dimensions.height, over: dimensions.height - box.height },
    ];
    const gaps = axes.filter((entry) => entry.over > 0);
    const candidate = { fits: gaps.length === 0, dimensions, gaps };
    if (candidate.fits) return candidate;
    if (!best || gaps.length < best.gaps.length
      || (gaps.length === best.gaps.length && gaps.reduce((sum, gap) => sum + gap.over, 0) < best.gaps.reduce((sum, gap) => sum + gap.over, 0))) {
      best = candidate;
    }
  }
  return best!;
}
