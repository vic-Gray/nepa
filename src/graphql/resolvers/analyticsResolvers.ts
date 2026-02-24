import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const analyticsResolvers = {
  Query: {
    dashboard: async (_: any, __: any, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      if (context.user.role !== 'ADMIN') {
        throw new Error('Access denied. Admin role required.');
      }

      try {
        const [
          totalUsers,
          totalBills,
          totalPayments,
          totalRevenueResult,
          recentPayments,
          overdueBills,
        ] = await Promise.all([
          prisma.user.count(),
          prisma.bill.count(),
          prisma.payment.count(),
          prisma.payment.aggregate({
            where: { status: 'SUCCESS' },
            _sum: { amount: true },
          }),
          prisma.payment.findMany({
            where: { status: 'SUCCESS' },
            include: { user: true, bill: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
          }),
          prisma.bill.findMany({
            where: {
              status: 'PENDING',
              dueDate: { lt: new Date() },
            },
            include: { user: true, utility: true },
            orderBy: { dueDate: 'asc' },
            take: 10,
          }),
        ]);

        // Calculate user growth for last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const userGrowth = await prisma.$queryRaw`
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as count
          FROM users 
          WHERE created_at >= ${thirtyDaysAgo}
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        `;

        // Calculate payment trends for last 30 days
        const paymentTrends = await prisma.$queryRaw`
          SELECT 
            DATE(created_at) as date,
            COALESCE(SUM(amount), 0) as amount
          FROM payments 
          WHERE created_at >= ${thirtyDaysAgo} AND status = 'SUCCESS'
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        `;

        return {
          totalUsers,
          totalBills,
          totalPayments,
          totalRevenue: totalRevenueResult._sum.amount || 0,
          recentPayments,
          overdueBills,
          userGrowth: userGrowth.map((item: any) => ({
            date: new Date(item.date),
            count: parseInt(item.count),
          })),
          paymentTrends: paymentTrends.map((item: any) => ({
            date: new Date(item.date),
            amount: parseFloat(item.amount),
          })),
        };
      } catch (error: any) {
        throw new Error(error.message || 'Dashboard data retrieval failed');
      }
    },
  },
};
