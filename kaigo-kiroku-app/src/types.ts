export type Lang = 'ja' | 'my';

export type FieldType = 'time' | 'number' | 'select' | 'text' | 'textarea';

export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  unit?: string;
  options?: string[];
  placeholder?: string;
  /** 数値の正常範囲（自由記録のときに注意を出す） */
  normal?: { min?: number; max?: number; note: string };
}

export interface CategoryDef {
  id: CategoryId;
  name: string;
  nameMy: string;
  icon: string;
  color: string;
  /** この記録で特に気をつけること */
  tips: string[];
  fields: FieldDef[];
}

export type CategoryId =
  | 'vital'
  | 'meal'
  | 'excretion'
  | 'bath'
  | 'medication'
  | 'sleep'
  | 'oral'
  | 'position'
  | 'activity'
  | 'behavior'
  | 'incident'
  | 'handover';

export interface Soap {
  s: string;
  o: string;
  a: string;
  p: string;
}

export interface FiveW1H {
  when: string;
  where: string;
  who: string;
  what: string;
  why: string;
  how: string;
}

/** 模範解答に含まれるべき要点。any のどれか1つが記録中にあれば OK */
export interface KeyPoint {
  label: string;
  any: string[];
  /** どの欄に書くべきか（ヒント表示用） */
  part?: 'S' | 'O' | 'A' | 'P';
}

export interface ExpectedField {
  value: string | number;
  /** 数値の許容誤差 */
  tolerance?: number;
}

export interface Scenario {
  id: string;
  category: CategoryId;
  title: string;
  level: 1 | 2 | 3;
  resident: string;
  /** 場面の文章。改行区切り */
  story: string;
  storyMy?: string;
  expected: Record<string, ExpectedField>;
  keyPoints: KeyPoint[];
  model: { w: FiveW1H; soap: Soap };
  /** 解説 */
  explanation: string;
}

export interface RecordEntry {
  id: string;
  createdAt: string;
  mode: 'scenario' | 'free';
  scenarioId?: string;
  category: CategoryId;
  resident: string;
  fields: Record<string, string>;
  w: FiveW1H;
  soap: Soap;
  score?: number;
}

export type Severity = 'good' | 'info' | 'warn' | 'error';

export interface Finding {
  severity: Severity;
  part: string;
  message: string;
  /** 該当した語句 */
  match?: string;
  suggestion?: string;
}
