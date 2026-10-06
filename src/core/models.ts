export type Dimensions = Readonly<{ length: number; width: number; height: number }>;
export type PlanMode = 'minimal' | 'comfort' | 'shopping';
export type RiskSeverity = 'critical' | 'warning' | 'info';
export type UnplacedReasonCode = 'invalid' | 'dimensions' | 'weight' | 'volume' | 'placement';

export interface Suitcase extends Dimensions {
  maxWeight: number;
}

export interface PackingItem extends Dimensions {
  id: string;
  name: string;
  category: string;
  weight: number;
  priority: 1 | 2 | 3;
  mustHave: boolean;
  fragile?: boolean;
}

export interface Placement {
  itemId: string;
  x: number;
  y: number;
  z: number;
  dimensions: Dimensions;
}

export interface UnplacedDimensionDeficit {
  itemAxis: 'length' | 'width' | 'height';
  required: number;
  available: number;
  deficit: number;
}

export interface UnplacedReason {
  code: UnplacedReasonCode;
  message: string;
  deficit?: number;
  remaining?: number;
  dimensions?: UnplacedDimensionDeficit[];
}

export interface UnplacedItem {
  item: PackingItem;
  reason: string;
  diagnostics: UnplacedReason[];
}

export interface PackingPlan {
  id: PlanMode;
  name: string;
  placements: Placement[];
  unplaced: UnplacedItem[];
  totalWeight: number;
  usedVolume: number;
  weightLimit: number;
  volumeLimit: number;
  capacityRatio: number;
}

export interface Risk {
  id: string;
  severity: RiskSeverity;
  title: string;
  message: string;
  itemId?: string;
  diagnostic?: boolean;
}

export interface PackingSnapshot {
  suitcase: Suitcase;
  items: PackingItem[];
  selectedPlan: PlanMode;
}

export function itemVolume(item: Dimensions): number {
  return item.length * item.width * item.height;
}

export function suitcaseVolume(suitcase: Dimensions): number {
  return suitcase.length * suitcase.width * suitcase.height;
}

export function formatMeasure(value: number, digits = 1): string {
  const precision = Math.pow(10, digits);
  return (Math.round(value * precision) / precision).toFixed(digits);
}
