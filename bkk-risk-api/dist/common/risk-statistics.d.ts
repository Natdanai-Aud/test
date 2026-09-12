import { RiskLevel } from './enums';
export interface RiskStatistics {
    accidentCount: number;
    fatalities: number;
    injuries: number;
    riskLevel: RiskLevel;
}
export declare function deriveRiskStatistics(clusterRank: number): RiskStatistics;
