import {
  riskPointPdfDetails,
  withPdfDetails,
} from './risk-point-pdf-details';

describe('riskPointPdfDetails', () => {
  it('covers every rank from 1 to 100 exactly once', () => {
    expect(normalizeRanks(riskPointPdfDetails)).toEqual(
      range(1, 100),
    );
  });

  it('gives every entry at least one cause item sourced from the same PDF', () => {
    for (const entry of riskPointPdfDetails) {
      expect(entry.causes.length).toBeGreaterThan(0);
      for (const cause of entry.causes) {
        expect(cause.sourceDocument).toBe(entry.sourceDocument);
        expect(cause.description.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('maps each entry to the PDF file that covers its rank', () => {
    const sourceFor = (rank: number) =>
      riskPointPdfDetails.find((e) => e.clusterRank === rank)
        ?.sourceDocument;

    expect(sourceFor(1)).toBe('660628-solutions-1-20.pdf');
    expect(sourceFor(20)).toBe('660628-solutions-1-20.pdf');
    expect(sourceFor(21)).toBe('660628-solutions-21-40.pdf');
    expect(sourceFor(40)).toBe('660628-solutions-21-40.pdf');
    expect(sourceFor(41)).toBe('660628-solutions-41-60.pdf');
    expect(sourceFor(60)).toBe('660628-solutions-41-60.pdf');
    expect(sourceFor(61)).toBe('660628-solutions-61-80.pdf');
    expect(sourceFor(80)).toBe('660628-solutions-61-80.pdf');
    expect(sourceFor(81)).toBe('660628-solutions-81-100.pdf');
    expect(sourceFor(100)).toBe('660628-solutions-81-100.pdf');
  });

  it('leaves solutions empty only for ranks whose PDF lacks the section', () => {
    const ranksWithoutSolutions = riskPointPdfDetails
      .filter((e) => e.solutions.length === 0)
      .map((e) => e.clusterRank);

    expect(ranksWithoutSolutions).toEqual([43, 84]);
  });

  it('keeps solution items sourced from the same PDF', () => {
    for (const entry of riskPointPdfDetails) {
      for (const solution of entry.solutions) {
        expect(solution.sourceDocument).toBe(entry.sourceDocument);
        expect(solution.description.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('withPdfDetails', () => {
  it('attaches PDF causes and solutions by cluster rank', () => {
    const point = {
      riskPointId: 'RP-014',
      clusterRank: 14,
      causes: [],
      solutions: [],
    };

    const enriched = withPdfDetails([point])[0];

    expect(enriched.riskPointId).toBe('RP-014');
    expect(enriched.causes).toHaveLength(3);
    expect(enriched.solutions).toHaveLength(3);
    expect(enriched.causes[0]).toEqual({
      description: 'รถทางขวา-ซ้าย มีการวิ่งตัดกัน',
      sourceDocument: '660628-solutions-1-20.pdf',
    });
  });

  it('leaves other fields untouched', () => {
    const point = { clusterRank: 27, nameTh: 'ถนนเอกชัยช่วงซอย 91-99' };

    const enriched = withPdfDetails([point])[0];

    expect(enriched.nameTh).toBe('ถนนเอกชัยช่วงซอย 91-99');
  });

  it('does not mutate the input point', () => {
    const point = { clusterRank: 1, causes: [], solutions: [] };

    withPdfDetails([point]);

    expect(point.causes).toEqual([]);
    expect(point.solutions).toEqual([]);
  });

  it('returns fresh copies of the notes so callers cannot corrupt the data', () => {
    const enriched = withPdfDetails([{ clusterRank: 1 }])[0];
    const description = enriched.causes[0].description;
    enriched.causes[0].description = 'mutated';

    expect(riskPointPdfDetails[0].causes[0].description).toBe(description);
  });

  it('keeps unmatched points with empty note arrays', () => {
    const enriched = withPdfDetails([
      { clusterRank: 101, nameTh: 'no pdf' },
    ])[0];

    expect(enriched.causes).toEqual([]);
    expect(enriched.solutions).toEqual([]);
    expect(enriched.nameTh).toBe('no pdf');
  });
});

function normalizeRanks(
  entries: Array<{ clusterRank: number }>,
): number[] {
  return entries
    .map((e) => e.clusterRank)
    .sort((a, b) => a - b);
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}