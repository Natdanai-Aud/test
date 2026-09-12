import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Bottleneck,
  RankingEntry,
  Remediation,
  RiskPoint,
} from './models';
import {
  CongestionLevel,
  RemediationStatus,
  RiskLevel,
} from './enums';
import { KmlRiskPointSource } from './kml-risk-point-source.service';
import { RiskStatistics, deriveRiskStatistics } from './risk-statistics';
import { withPdfDetails } from '../data/risk-point-pdf-details';

function seedRiskPoints(): RiskPoint[] {
  const districts = [
    'จตุจักร',
    'ห้วยขวาง',
    'บางนา',
    'วัฒนา',
    'ดินแดง',
    'พระนคร',
    'ปทุมวัน',
    'ลาดพร้าว',
    'บางกะปิ',
    'คลองเตย',
  ];

  const points: RiskPoint[] = Array.from({ length: 100 }, (_, index) => {
    const rank = index + 1;
    const district = districts[index % districts.length];
    const statistics: RiskStatistics = deriveRiskStatistics(rank);

    return {
      riskPointId: `RP-${String(rank).padStart(3, '0')}`,
      clusterRank: rank,
      nameTh: `จุดเสี่ยงจำลอง ${String(rank).padStart(3, '0')}`,
      district,
      road: `ถนนจำลองสาย ${rank}`,
      lat: 13.70 + (index % 20) * 0.008,
      lng: 100.47 + (index % 20) * 0.007,
      accidentCount: statistics.accidentCount,
      fatalities: statistics.fatalities,
      injuries: statistics.injuries,
      riskLevel: statistics.riskLevel,
      dataYearRange: '2566-2568',
      causes: [],
      solutions: [],
    };
  });

  Object.assign(points[6], {
    nameTh: 'แยกบางนา',
    district: 'บางนา',
    road: 'ถนนเทพรัตน',
    lat: 13.6687,
    lng: 100.603,
    accidentCount: 377,
    fatalities: 11,
    injuries: 352,
    riskLevel: RiskLevel.CRITICAL,
  });

  Object.assign(points[13], {
    nameTh: 'แยกอโศก-เพชรบุรี',
    district: 'ห้วยขวาง',
    road: 'ถนนอโศกมนตรี',
    lat: 13.7375,
    lng: 100.5601,
    accidentCount: 210,
    fatalities: 3,
    injuries: 198,
    riskLevel: RiskLevel.HIGH,
  });

  return withPdfDetails(points);
}

@Injectable()
export class MockDataService implements OnModuleInit {
  private _riskPoints: RiskPoint[] = seedRiskPoints();

  constructor(private readonly kmlRiskPointSource: KmlRiskPointSource) {}

  async onModuleInit() {
    const points = await this.kmlRiskPointSource.fetchRiskPoints();
    if (points && points.length > 0) {
      this._riskPoints = withPdfDetails(points);
    }
  }

  private readonly _remediations: Remediation[] = [
    {
      remediationId: 'RM-001',
      riskPointId: 'RP-001',
      status: RemediationStatus.IN_PROGRESS,
      responsibleAgency: 'สำนักการจราจรและขนส่ง',
      startedAt: '2026-03-10',
      dueAt: '2026-06-30',
      completedAt: null,
      note: 'รอผลการจัดซื้อจัดจ้างอุปกรณ์ไฟส่องสว่าง',
      updatedAt: '2026-07-28T14:05:00+07:00',
    },
    {
      remediationId: 'RM-007',
      riskPointId: 'RP-007',
      status: RemediationStatus.COMPLETED,
      responsibleAgency: 'สำนักการจราจรและขนส่ง',
      startedAt: '2026-01-15',
      dueAt: '2026-04-30',
      completedAt: '2026-04-22',
      note: 'ติดตั้งสัญญาณไฟคนข้ามแบบกดปุ่มแล้วเสร็จ',
      updatedAt: '2026-04-22T16:40:00+07:00',
    },
    {
      remediationId: 'RM-014',
      riskPointId: 'RP-014',
      status: RemediationStatus.PENDING,
      responsibleAgency: 'สำนักการจราจรและขนส่ง',
      startedAt: null,
      dueAt: '2026-12-15',
      completedAt: null,
      note: 'อยู่ระหว่างจัดทำแบบ',
      updatedAt: '2026-08-01T10:00:00+07:00',
    },
  ];

  private readonly _bottlenecks: Bottleneck[] = [
    {
      bottleneckId: 'BN-003',
      nameTh: 'หน้าห้างเซ็นทรัลลาดพร้าว',
      district: 'จตุจักร',
      road: 'ถนนพหลโยธิน',
      lat: 13.8163,
      lng: 100.5606,
      congestionLevel: CongestionLevel.BLOCKED,
      avgSpeedKmh: 6.5,
      observedAt: '2026-08-07T17:45:00+07:00',
    },
    {
      bottleneckId: 'BN-011',
      nameTh: 'ทางลงด่วนพระราม 9',
      district: 'ห้วยขวาง',
      road: 'ถนนพระราม 9',
      lat: 13.7566,
      lng: 100.5661,
      congestionLevel: CongestionLevel.CONGESTED,
      avgSpeedKmh: 18.2,
      observedAt: '2026-08-07T17:45:00+07:00',
    },
    {
      bottleneckId: 'BN-015',
      nameTh: 'แยกปทุมวัน',
      district: 'ปทุมวัน',
      road: 'ถนนพระราม 1',
      lat: 13.7449,
      lng: 100.5331,
      congestionLevel: CongestionLevel.NORMAL,
      avgSpeedKmh: 42.3,
      observedAt: '2026-08-07T17:45:00+07:00',
    },
  ];

  private _ranking: RankingEntry[] = [];
  private _rankedAt = '2026-08-01T02:15:00+07:00';

  get riskPoints(): RiskPoint[] {
    return this._riskPoints;
  }

  get remediations(): Remediation[] {
    return this._remediations;
  }

  get bottlenecks(): Bottleneck[] {
    return this._bottlenecks;
  }

  get ranking(): RankingEntry[] {
    return this._ranking;
  }

  get rankedAt(): string {
    return this._rankedAt;
  }

  replaceRanking(items: RankingEntry[], rankedAt = new Date().toISOString()) {
    this._ranking = items;
    this._rankedAt = rankedAt;
  }
}
