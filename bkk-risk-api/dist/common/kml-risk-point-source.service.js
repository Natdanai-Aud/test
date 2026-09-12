"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var KmlRiskPointSource_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KmlRiskPointSource = exports.GOOGLE_MAPS_KML_URL = void 0;
const common_1 = require("@nestjs/common");
const fast_xml_parser_1 = require("fast-xml-parser");
const risk_statistics_1 = require("./risk-statistics");
exports.GOOGLE_MAPS_KML_URL = 'https://www.google.com/maps/d/kml?mid=1hTC9XwOVzmX3sFLOchZmABrMogXGRPA&forcekml=1';
const KML_FETCH_TIMEOUT_MS = 10_000;
const DATA_YEAR_RANGE = '2566-2568';
const MAIN_FOLDER_NAME = 'จุดเสี่ยงอุบัติเหตุสูงสุด 3 ปีย้อนหลัง';
let KmlRiskPointSource = KmlRiskPointSource_1 = class KmlRiskPointSource {
    logger = new common_1.Logger(KmlRiskPointSource_1.name);
    parser = new fast_xml_parser_1.XMLParser({ ignoreAttributes: false });
    async fetchRiskPoints() {
        try {
            const response = await fetch(exports.GOOGLE_MAPS_KML_URL, {
                signal: AbortSignal.timeout(KML_FETCH_TIMEOUT_MS),
            });
            if (!response.ok) {
                this.logger.warn(`KML fetch failed with status ${response.status} ${response.statusText}`);
                return null;
            }
            const xml = await response.text();
            const points = this.parseKml(xml);
            if (points.length > 0) {
                this.logger.log(`Loaded ${points.length} risk points from Google My Maps`);
            }
            else {
                this.logger.warn('KML contained no point placemarks');
            }
            return points;
        }
        catch (error) {
            this.logger.warn(`KML fetch failed: ${error.message}`);
            return null;
        }
    }
    parseKml(xml) {
        const document = this.parser.parse(xml);
        const placemarks = this.collectPlacemarks(document?.kml?.Document);
        return placemarks
            .map((placemark, index) => this.mapPlacemark(placemark, index))
            .filter((point) => point !== null);
    }
    collectPlacemarks(node) {
        const result = [];
        const walk = (value, inMainFolder) => {
            if (Array.isArray(value)) {
                value.forEach((item) => walk(item, inMainFolder));
                return;
            }
            if (!value || typeof value !== 'object') {
                return;
            }
            const record = value;
            const isMainFolder = inMainFolder || record.name === MAIN_FOLDER_NAME;
            if (record.Placemark && isMainFolder) {
                const placemarks = Array.isArray(record.Placemark)
                    ? record.Placemark
                    : [record.Placemark];
                placemarks.forEach((p) => {
                    if (p && typeof p === 'object') {
                        result.push(p);
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
    mapPlacemark(placemark, index) {
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
        const district = this.getExtendedData(placemark, 'เขต') ??
            this.getDescriptionValue(placemark, 'เขต') ??
            '';
        const statistics = (0, risk_statistics_1.deriveRiskStatistics)(clusterRank);
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
    extractRoad(nameTh) {
        const match = nameTh.match(/\(ถ\.([^)]+)\)/);
        return match ? `ถ.${match[1].trim()}` : undefined;
    }
    getExtendedData(placemark, key) {
        const data = placemark.ExtendedData?.Data;
        if (!data) {
            return undefined;
        }
        const entries = Array.isArray(data) ? data : [data];
        const entry = entries.find((item) => this.normalizeKey(item['@_name']) === key);
        return entry?.value?.trim() || undefined;
    }
    getDescriptionValue(placemark, key) {
        const description = placemark.description ?? '';
        const line = description
            .split('<br>')
            .find((value) => value.startsWith(`${key} ::`));
        const value = line?.split('::')[1];
        return value?.trim() || undefined;
    }
    normalizeKey(key) {
        return (key ?? '').trim().replace(/[:\s\u00A0]+$/, '');
    }
};
exports.KmlRiskPointSource = KmlRiskPointSource;
exports.KmlRiskPointSource = KmlRiskPointSource = KmlRiskPointSource_1 = __decorate([
    (0, common_1.Injectable)()
], KmlRiskPointSource);
//# sourceMappingURL=kml-risk-point-source.service.js.map