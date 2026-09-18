import { Global, Module } from '@nestjs/common';
import { KmlRiskPointSource } from './kml-risk-point-source.service';
import { MockDataService } from './mock-data.service';

@Global()
@Module({
  providers: [MockDataService, KmlRiskPointSource],
  exports: [MockDataService],
})
export class MockDataModule {}
