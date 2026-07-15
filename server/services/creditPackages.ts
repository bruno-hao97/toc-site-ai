export interface CreditPackage {
  id: string;
  name: string;
  amountVnd: number;
  credits: number;
  bonusPercent: number;
  featured?: boolean;
  prioritySupport?: boolean;
}

export const CREDIT_PACKAGES: readonly CreditPackage[] = [
  {
    id: 'basic-member',
    name: 'BASIC - MEMBER',
    amountVnd: 50_000,
    credits: 50_000,
    bonusPercent: 0,
  },
  {
    id: 'vip-member',
    name: 'VIP MEMBER',
    amountVnd: 200_000,
    credits: 210_000,
    bonusPercent: 5,
  },
  {
    id: 'ultra-member',
    name: 'ULTRA MEMBER',
    amountVnd: 1_000_000,
    credits: 1_100_000,
    bonusPercent: 10,
    featured: true,
    prioritySupport: true,
  },
  {
    id: 'infinity-member',
    name: 'INFINITY MEMBER',
    amountVnd: 5_000_000,
    credits: 5_750_000,
    bonusPercent: 12,
    prioritySupport: true,
  },
  {
    id: 'agency-pro',
    name: 'AGENCY PRO',
    amountVnd: 10_000_000,
    credits: 11_500_000,
    bonusPercent: 15,
    prioritySupport: true,
  },
  {
    id: 'master-agency',
    name: 'MASTER AGENCY',
    amountVnd: 20_000_000,
    credits: 24_000_000,
    bonusPercent: 20,
    prioritySupport: true,
  },
];

export function getCreditPackage(packageId: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((item) => item.id === packageId);
}
