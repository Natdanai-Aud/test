import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { RiskPoint } from './models';
import { deriveRiskStatistics } from './risk-statistics';

export const GOOGLE_MAPS_KML_URL =
  'https://www.google.com/maps/d/kml?mid=1hTC9XwOVzmX3sFLOchZmABrMogXGRPA&forcekml=1';

const KML_FETCH_TIMEOUT_MS = 10_000;
const DATA_YEAR_RANGE = '2566-2568';
const MAIN_FOLDER_NAME = 'จุดเสี่ยงอุบัติเหตุสูงสุด 3 ปีย้อนหลัง';

interface KmlPlacemark {
  name?: string;
  description?: string;
  styleUrl?: string;
  ExtendedData?: {
    Data?: Array<{ value?: string; '@_name'?: string }>;
  };
  Point?: { coordinates?: string };
}

@Injectable()
export class KmlRiskPointSource {
  private readonly logger = new Logger(KmlRiskPointSource.name);
  private readonly parser = new XMLParser({ ignoreAttributes: false });

  async fetchRiskPoints(): Promise<RiskPoint[] | null> {
    try {
      const response = await fetch(GOOGLE_MAPS_KML_URL, {
        signal: AbortSignal.timeout(KML_FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(
          `KML fetch failed with status ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const xml = await response.text();
      const points = this.parseKml(xml);

      if (points.length > 0) {
        this.logger.log(
          `Loaded ${points.length} risk points from Google My Maps`,
        );
      } else {
        this.logger.warn('KML contained no point placemarks');
      }

      return points;
    } catch (error) {
      this.logger.warn(
        `KML fetch failed: ${(error as Error).message}`,
      );
      return null;
    }
  }

  parseKml(xml: string): RiskPoint[] {
    const document = this.parser.parse(xml);
    const placemarks = this.collectPlacemarks(document?.kml?.Document);

    return placemarks
      .map((placemark, index) => this.mapPlacemark(placemark, index))
      .filter((point): point is RiskPoint => point !== null);
  }

  private collectPlacemarks(node: unknown): KmlPlacemark[] {
    const result: KmlPlacemark[] = [];

    const walk = (value: unknown, inMainFolder: boolean) => {
      if (Array.isArray(value)) {
        value.forEach((item) => walk(item, inMainFolder));
        return;
      }
      if (!value || typeof value !== 'object') {
        return;
      }

      const record = value as Record<string, unknown>;
      const isMainFolder = inMainFolder || record.name === MAIN_FOLDER_NAME;

      if (record.Placemark && isMainFolder) {
        const placemarks = Array.isArray(record.Placemark)
          ? record.Placemark
          : [record.Placemark];
        placemarks.forEach((p) => {
          if (p && typeof p === 'object') {
            result.push(p as KmlPlacemark);
          }
        });
      }

      if (record.Folder) {
        const folders = Array.isArray(record.Folder)
          ? record.Folder
          : [record.Folder];
        folders.forEach((folder) => walk(folder, isMainFolder));
      }
    };

    walk(node, false);
    return result;
  }

  private mapPlacemark(
    placemark: KmlPlacemark,
    index: number,
  ): RiskPoint | null {
    const coordinates = placemark.Point?.coordinates?.trim();
    if (!coordinates) {
      return null;
    }

    const [lngRaw, latRaw] = coordinates.split(',');
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    const name = (placemark.name ?? '').trim();
    const rankMatch = name.match(/^(\d+)\.\s*(.*)$/);
    const clusterRank = rankMatch ? Number(rankMatch[1]) : index + 1;
    const nameTh = (rankMatch ? rankMatch[2] : name).trim();
    const road = this.extractRoad(nameTh);
    const district =
      this.getExtendedData(placemark, 'เขต') ??
      this.getDescriptionValue(placemark, 'เขต') ??
      '';
    const statistics = deriveRiskStatistics(clusterRank);

    return {
      riskPointId: `RP-${String(clusterRank).padStart(3, '0')}`,
      clusterRank,
      nameTh,
      district,
      road,
      lat,
      lng,
      accidentCount: statistics.accidentCount,
      fatalities: statistics.fatalities,
      injuries: statistics.injuries,
      riskLevel: statistics.riskLevel,
      dataYearRange: DATA_YEAR_RANGE,
      causes: [],
      solutions: [],
    };
  }

  private extractRoad(nameTh: string): string | undefined {
    const match = nameTh.match(/\(ถ\.([^)]+)\)/);
    return match ? `ถ.${match[1].trim()}` : undefined;
  }

  private getExtendedData(placemark: KmlPlacemark, key: string): string | undefined {
    const data = placemark.ExtendedData?.Data;
    if (!data) {
      return undefined;
    }

    const entries = Array.isArray(data) ? data : [data];
    const entry = entries.find(
      (item) => this.normalizeKey(item['@_name']) === key,
    );
    return entry?.value?.trim() || undefined;
  }

  private getDescriptionValue(
    placemark: KmlPlacemark,
    key: string,
  ): string | undefined {
    const description = placemark.description ?? '';
    const line = description
      .split('<br>')
      .find((value) => value.startsWith(`${key} ::`));
    const value = line?.split('::')[1];
    return value?.trim() || undefined;
  }

  private normalizeKey(key?: string): string {
    return (key ?? '').trim().replace(/[:\s\u00A0]+$/, '');
  }
}