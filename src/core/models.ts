export type Dimensions = Readonly<{ length: number; width: number; height: number }>;
export type PlanMode = 'minimal' | 'comfort' | 'shopping';
export type RiskSeverity = 'critical' | 'warning' | 'info';

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

export type CheckStatus = 'pass' | 'fail' | 'skipped';

export type DimensionGap = Readonly<{ axis: '长' | '宽' | '高'; actual: number; required: number; over: number }>;

export interface UnplacedCheck {
  key: 'valid' | 'dimensions' | 'weight' | 'volume' | 'placement';
  label: string;
  status: CheckStatus;
  detail: string;
  /** 该检查未通过时与限制条件的实际差额；重量为 kg，体积为 cm³，尺寸为 cm。 */
  shortfall?: number;
  gaps?: DimensionGap[];
}

export interface UnplacedDiagnosis {
  item: PackingItem;
  /** 未装入的首要原因，指向 checks 中第一条 fail。 */
  reason: string;
  checks: UnplacedCheck[];
}

export interface PackingPlan {
  id: PlanMode;
  name: string;
  placements: Placement[];
  unplaced: UnplacedDiagnosis[];
  totalWeight: number;
  usedVolume: number;
  capacityRatio: number;
}

export interface Risk {
  id: string;
  severity: RiskSeverity;
  title: string;
  message: string;
  itemId?: string;
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
