"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveRiskStatistics = deriveRiskStatistics;
const enums_1 = require("./enums");
function deriveRiskStatistics(clusterRank) {
    const accidents = Math.max(58, 420 - (clusterRank - 1) * 3);
    const fatalities = Math.max(1, 12 - Math.floor((clusterRank - 1) / 12));
    const injuries = Math.max(40, 390 - (clusterRank - 1) * 3);
    const riskLevel = accidents >= 300
        ? enums_1.RiskLevel.CRITICAL
        : accidents >= 220
            ? enums_1.RiskLevel.HIGH
            : accidents >= 130
                ? enums_1.RiskLevel.MEDIUM
                : enums_1.RiskLevel.LOW;
    return { accidentCount: accidents, fatalities, injuries, riskLevel };
}
//# sourceMappingURL=risk-statistics.js.map