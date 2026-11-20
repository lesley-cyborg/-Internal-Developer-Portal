import { Router, Request, Response } from 'express';
import prisma from '../prismaClient';

const router = Router();

// GET /api/v1/pull-requests — table data + per-row time-to-merge (hours)
router.get('/pull-requests', async (req: Request, res: Response) => {
  try {
    // 1. Use Prisma's findMany to automatically handle column name mapping
    const rows = await prisma.pullRequest.findMany({
      select: {
        number: true,
        title: true,
        author: true,
        state: true,
        securityStatus: true,
        createdAt: true,
        mergedAt: true,
      },
      orderBy: {
        number: 'desc',
      },
    });

    // 2. Calculate time_to_merge_hours in JS and map to snake_case for the frontend API contract
    const formattedRows = rows.map((row) => {
      let time_to_merge_hours = null;
      if (row.mergedAt && row.createdAt) {
        const created = new Date(row.createdAt).getTime();
        const merged = new Date(row.mergedAt).getTime();
        time_to_merge_hours = Number(((merged - created) / (1000 * 60 * 60)).toFixed(2));
      }
      
      return {
        number: row.number,
        title: row.title,
        author: row.author,
        state: row.state,
        security_status: row.securityStatus, // Map to snake_case for frontend
        created_at: row.createdAt,
        merged_at: row.mergedAt,
        time_to_merge_hours,
      };
    });

    res.json({ count: formattedRows.length, pull_requests: formattedRows });
  } catch (error) {
    console.error('❌ GET /pull-requests error:', error);
    res.status(500).json({ error: 'Failed to fetch pull requests' });
  }
});

// GET /api/v1/metrics/summary — aggregate KPIs for the top cards
router.get('/metrics/summary', async (req: Request, res: Response) => {
  try {
    // Fetch only the fields we need for the summary
    const allPrs = await prisma.pullRequest.findMany({
      select: {
        state: true,
        securityStatus: true,
        createdAt: true,
        mergedAt: true,
      }
    });

    const total_prs = allPrs.length;
    const merged_prs = allPrs.filter(pr => pr.mergedAt !== null).length;
    const blocked_prs = allPrs.filter(pr => pr.securityStatus === 'blocked').length;

    // Calculate average time to merge (only for merged PRs)
    let avg_time_to_merge_hours = null;
    const mergedTimes = allPrs
      .filter(pr => pr.mergedAt && pr.createdAt)
      .map(pr => (new Date(pr.mergedAt!).getTime() - new Date(pr.createdAt!).getTime()) / (1000 * 60 * 60));
    
    if (mergedTimes.length > 0) {
      const sum = mergedTimes.reduce((a, b) => a + b, 0);
      avg_time_to_merge_hours = Number((sum / mergedTimes.length).toFixed(2));
    }

    res.json({
      total_prs,
      merged_prs,
      blocked_prs,
      avg_time_to_merge_hours,
      security_fail_rate: total_prs > 0 ? Number((blocked_prs / total_prs).toFixed(2)) : 0,
    });
  } catch (error) {
    console.error('❌ GET /metrics/summary error:', error);
    res.status(500).json({ error: 'Failed to compute metrics' });
  }
});

// GET /api/v1/activity — Live feed of recent webhook events
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const events = await prisma.webhookEvent.findMany({
      take: 10, // Last 10 events
      orderBy: { createdAt: 'desc' },
      select: {
        event: true,
        deliveryId: true,
        createdAt: true,
      }
    });

    res.json({ events });
  } catch (error) {
    console.error('❌ GET /activity error:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

export default router;
