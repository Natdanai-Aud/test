import {
  GOOGLE_MAPS_KML_URL,
  KmlRiskPointSource,
} from './kml-risk-point-source.service';
import { MockDataService } from './mock-data.service';
import { RiskLevel } from './enums';
import { RiskPoint } from './models';
import { withPdfDetails } from '../data/risk-point-pdf-details';

const sampleKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>การปรับปรุง 100 จุดเสี่ยงอุบัติเหตุ (Black Spot)</name>
    <Folder>
      <name>จุดเสี่ยงอุบัติเหตุสูงสุด 3 ปีย้อนหลัง</name>
      <Placemark>
        <name>1. แยกพัฒนาการ (ถ.พัฒนาการ - ศรีนครินทร์)</name>
        <description><![CDATA[เขต :: สวนหลวง<br>กลุ่มเขต :: กรุงเทพใต้<br>สน.พื้นที่ :: คลองตัน,ประเวศ<br>พิกัด :: 13.735236, 100.641140<br>พื้นที่ความรับผิดชอบ :: กทม.]]></description>
        <styleUrl>#icon-1769-0F9D58</styleUrl>
        <ExtendedData>
          <Data name="เขต :">
            <value>สวนหลวง</value>
          </Data>
          <Data name="กลุ่มเขต :">
            <value>กรุงเทพใต้</value>
          </Data>
          <Data name="สน.พื้นที่ :">
            <value>คลองตัน,ประเวศ</value>
          </Data>
          <Data name="พิกัด :">
            <value>13.735236, 100.641140</value>
          </Data>
          <Data name="พื้นที่ความรับผิดชอบ :">
            <value>กทม.</value>
          </Data>
        </ExtendedData>
        <Point>
          <coordinates>100.64114,13.735236,0</coordinates>
        </Point>
      </Placemark>
      <Placemark>
        <name>2. ถนนประชาธิปก (ใกล้วงเวียนใหญ่)</name>
        <description><![CDATA[เขต :: ธนบุรี<br>กลุ่มเขต :: กรุงธนเหนือ<br>สน.พื้นที่ :: บุปผาราม<br>พื้นที่ความรับผิดชอบ :: กทม.]]></description>
        <Point>
          <coordinates>100.493022,13.726948,0</coordinates>
        </Point>
      </Placemark>
      <Placemark>
        <name>3. แยกบางหว้า (ถนนเพชรเกษม ตัดถนนราชพฤกษ์)</name>
        <description><![CDATA[เขต :: ภาษีเจริญ<br>กลุ่มเขต :: กรุงธนใต้<br>พื้นที่ความรับผิดชอบ :: กรมทางหลวงชนบท]]></description>
        <Point>
          <coordinates>100.4577,13.720691,0</coordinates>
        </Point>
      </Placemark>
    </Folder>
    <Folder>
      <name>15 จุดเสี่ยงฯเพิ่มเติม (ตามตัวชี้วัด)</name>
      <Placemark>
        <name>1. จุดเพิ่มเติมบางกะปิ</name>
        <description><![CDATA[เขต :: บางกะปิ<br>พื้นที่ความรับผิดชอบ :: กทม.]]></description>
        <Point>
          <coordinates>100.65,13.77,0</coordinates>
        </Point>
      </Placemark>
    </Folder>
    <Folder>
      <name>base_kml</name>
      <Placemark>
        <name>Polygon boundary (non-point, should be ignored)</name>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>100.5,13.7,0 100.6,13.7,0 100.6,13.8,0</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>
    </Folder>
  </Document>
</kml>`;

describe('KmlRiskPointSource', () => {
  let source: KmlRiskPointSource;

  beforeEach(() => {
    source = new KmlRiskPointSource();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('parseKml', () => {
    it('maps placemarks to RiskPoint objects', () => {
      const points = source.parseKml(sampleKml);

      expect(points).toHaveLength(3);

      const first = points[0];
      expect(first.riskPointId).toBe('RP-001');
      expect(first.clusterRank).toBe(1);
      expect(first.nameTh).toBe('แยกพัฒนาการ (ถ.พัฒนาการ - ศรีนครินทร์)');
      expect(first.district).toBe('สวนหลวง');
      expect(first.road).toBe('ถ.พัฒนาการ - ศรีนครินทร์');
      expect(first.lat).toBeCloseTo(13.735236, 5);
      expect(first.lng).toBeCloseTo(100.64114, 5);
      expect(first.causes).toEqual([]);
      expect(first.solutions).toEqual([]);
      expect(first.dataYearRange).toBe('2566-2568');
    });

    it('keeps mock statistics formula keyed on cluster rank', () => {
      const points = source.parseKml(sampleKml);

      expect(points[0].accidentCount).toBe(420);
      expect(points[0].fatalities).toBe(12);
      expect(points[0].injuries).toBe(390);
      expect(points[0].riskLevel).toBe(RiskLevel.CRITICAL);

      expect(points[1].accidentCount).toBe(417);
      expect(points[1].riskLevel).toBe(RiskLevel.CRITICAL);
    });

    it('falls back to the description when ExtendedData is missing', () => {
      const points = source.parseKml(sampleKml);

      expect(points[2].district).toBe('ภาษีเจริญ');
    });

    it('ignores non-point placemarks like polygons', () => {
      const points = source.parseKml(sampleKml);

      expect(points.some((p) => p.nameTh.includes('Polygon'))).toBe(false);
    });

    it('ignores points in non-main folders even with duplicate ranks', () => {
      const points = source.parseKml(sampleKml);

      expect(points).toHaveLength(3);
      expect(points.some((p) => p.nameTh.includes('จุดเพิ่มเติม'))).toBe(false);
    });
  });

  describe('fetchRiskPoints', () => {
    it('returns null when the request fails with non-ok status', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      await expect(source.fetchRiskPoints()).resolves.toBeNull();
      expect(fetchMock).toHaveBeenCalledWith(
        GOOGLE_MAPS_KML_URL,
        expect.objectContaining({ signal: expect.anything() }),
      );
    });

    it('returns null when the request throws', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

      await expect(source.fetchRiskPoints()).resolves.toBeNull();
    });

    it('parses fetched XML into risk points', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(sampleKml),
      }) as unknown as typeof fetch;

      const points = await source.fetchRiskPoints();

      expect(points).toHaveLength(3);
      expect(points?.[0].nameTh).toContain('แยกพัฒนาการ');
    });
  });
});

describe('MockDataService fallback', () => {
  it('keeps seeded mock points when the KML source returns null', async () => {
    const source = {
      fetchRiskPoints: jest.fn().mockResolvedValue(null),
    } as unknown as KmlRiskPointSource;
    const service = new MockDataService(source);

    await service.onModuleInit();

    expect(service.riskPoints).toHaveLength(100);
    expect(service.riskPoints[0].riskPointId).toBe('RP-001');
  });

  it('replaces seeded points when the KML source returns points', async () => {
    const kmlSource = new KmlRiskPointSource();
    const kmlPoints: RiskPoint[] = [
      {
        riskPointId: 'RP-001',
        clusterRank: 1,
        nameTh: 'แยกพัฒนาการ',
        district: 'สวนหลวง',
        lat: 13.735236,
        lng: 100.64114,
        accidentCount: 420,
        fatalities: 12,
        injuries: 390,
        riskLevel: RiskLevel.CRITICAL,
        dataYearRange: '2566-2568',
        causes: [],
        solutions: [],
      },
    ];
    const source = {
      fetchRiskPoints: jest.fn().mockResolvedValue(kmlPoints),
    } as unknown as typeof kmlSource;
    const service = new MockDataService(source);

    await service.onModuleInit();

    expect(service.riskPoints).toEqual(withPdfDetails(kmlPoints));
    expect(service.riskPoints).toHaveLength(1);
    expect(service.riskPoints[0].causes).toHaveLength(3);
    expect(service.riskPoints[0].solutions).toHaveLength(3);
  });
});