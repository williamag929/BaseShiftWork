export interface PtoBalance {
  personId: number;
  balance: number;
  asOf: Date;
}

export interface ConfigurePtoDto {
  accrualRatePerMonth?: number;
  startingBalance?: number;
  startDate?: Date;
}
