import { RiskPoint } from './models';
export declare const GOOGLE_MAPS_KML_URL = "https://www.google.com/maps/d/kml?mid=1hTC9XwOVzmX3sFLOchZmABrMogXGRPA&forcekml=1";
export declare class KmlRiskPointSource {
    private readonly logger;
    private readonly parser;
    fetchRiskPoints(): Promise<RiskPoint[] | null>;
    parseKml(xml: string): RiskPoint[];
    private collectPlacemarks;
    private mapPlacemark;
    private extractRoad;
    private getExtendedData;
    private getDescriptionValue;
    private normalizeKey;
}
