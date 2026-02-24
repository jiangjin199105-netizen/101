export interface DrawRecord {
  period: string;
  result: number[] | string;
  time: string;
  sum?: number;
  bigSmall?: string;
  oddEven?: string;
}

export interface Recommendation {
  period: string; // The period being predicted
  basedOnPeriod: string; // The latest period used for analysis
  recommendedNumbers: number[];
  status: 'pending' | 'won' | 'lost';
  actualChampion?: number;
  patternType: string;
  createTime: number;
  bettingStep: number; // 1, 2, 3, 4
  profit?: number;
}
