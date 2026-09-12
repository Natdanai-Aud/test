import { OnModuleInit } from '@nestjs/common';
import { Bottleneck, RankingEntry, Remediation, RiskPoint } from './models';
import { KmlRiskPointSource } from './kml-risk-point-source.service';
export declare class MockDataService implements OnModuleInit {
    private readonly kmlRiskPointSource;
    private _riskPoints;
    constructor(kmlRiskPointSource: KmlRiskPointSource);
    onModuleInit(): Promise<void>;
    private readonly _remediations;
    private readonly _bottlenecks;
    private _ranking;
    private _rankedAt;
    get riskPoints(): RiskPoint[];
    get remediations(): Remediation[];
    get bottlenecks(): Bottleneck[];
    get ranking(): RankingEntry[];
    get rankedAt(): string;
    replaceRanking(items: RankingEntry[], rankedAt?: string): void;
}
