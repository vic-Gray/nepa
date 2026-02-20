import { PrismaClient, BillStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class AnalyticsService {
  async getBillingStats() {
    const totalRevenue = await prisma.payment.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { amount: true }
    });

    const overdueCount = await prisma.bill.count({
      where: { status: BillStatus.OVERDUE }
    });

    const pendingCount = await prisma.bill.count({
      where: { status: BillStatus.PENDING }
    });

    return {
      totalRevenue: totalRevenue._sum.amount || 0,
      overdueBills: overdueCount,
      pendingBills: pendingCount
    };
  }

  async getLateFeeRevenue() {
    return prisma.bill.aggregate({
      where: { lateFee: { gt: 0 } },
      _sum: { lateFee: true }
    });
  }
}