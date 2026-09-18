import { SourcedNote } from '../common/models';
export interface RiskPointPdfDetails {
    clusterRank: number;
    sourceDocument: string;
    causes: SourcedNote[];
    solutions: SourcedNote[];
}
export declare const riskPointPdfDetails: RiskPointPdfDetails[];
export declare function withPdfDetails<T extends {
    clusterRank: number;
}>(points: T[]): Array<T & {
    causes: SourcedNote[];
    solutions: SourcedNote[];
}>;
