import { RiskLevel } from './enums';

export interface RiskStatistics {
  accidentCount: number;
  fatalities: number;
  injuries: number;
  riskLevel: RiskLevel;
}

export function deriveRiskStatistics(clusterRank: number): RiskStatistics {
  const accidents = Math.max(58, 420 - (clusterRank - 1) * 3);
  const fatalities = Math.max(1, 12 - Math.floor((clusterRank - 1) / 12));
  const injuries = Math.max(40, 390 - (clusterRank - 1) * 3);

  const riskLevel =
    accidents >= 300
      ? RiskLevel.CRITICAL
      : accidents >= 220
        ? RiskLevel.HIGH
        : accidents >= 130
          ? RiskLevel.MEDIUM
          : RiskLevel.LOW;

  return { accidentCount: accidents, fatalities, injuries, riskLevel };
}