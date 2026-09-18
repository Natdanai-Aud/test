import { Injectable } from '@nestjs/common';
import { MockDataService } from '../common/mock-data.service';
import { RankingEntry, RankingResult } from '../common/models';

@Injectable()
export class RankingService {
  constructor(private readonly mockData: MockDataService) {}

  findTop(district?: string, limit = 10) {
    const items = this.mockData.ranking.filter(
      (item) => !district || item.district === district,
    );

    // Ranking is a stored/precomputed view. It is intentionally not
    // recalculated for normal GET requests.
    return {
      rankedAt: this.mockData.rankedAt,
      items: items.slice(0, limit),
    };
  }

  rebuild(): RankingResult {
    const points = this.mockData.riskPoints;
    const rawScores = points.map(
      (p) => p.accidentCount + (p.fatalities ?? 0) * 20 + (p.injuries ?? 0) * 0.2,
    );
    const max = Math.max(...rawScores);

    // OpenAPI specifies what inputs contribute to riskScore, but does not
    // specify exact weights. This mock implementation therefore uses a
    // transparent deterministic formula that can be replaced later.
    const entries: RankingEntry[] = points
      .map((point, index) => ({
        rank: 0,
        riskPointId: point.riskPointId,
        nameTh: point.nameTh,
        district: point.district,
        riskScore: Number(((rawScores[index] / max) * 100).toFixed(1)),
        accidentCount: point.accidentCount,
        fatalities: point.fatalities,
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    const rankedAt = new Date().toISOString();
    this.mockData.replaceRanking(entries, rankedAt);

    return {
      rankedAt,
      pointsProcessed: points.length,
    };
  }

  seedInitialRanking() {
    if (!this.mockData.ranking.length) {
      this.rebuild();
    }
  }
}
