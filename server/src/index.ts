import express, { Request, Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import prisma from './prismaClient';

const app = express();
// Explicitly cast PORT to a number to satisfy TypeScript
const port: number = Number(process.env.PORT) || 3001;
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'my_super_secret_devpulse_key_123';

app.use(cors());

// CRITICAL: Capture the raw body buffer to verify he HMAC signature accurately.  
// GitHub sends raw JSON. We need express.json() to parse it.
app.use(express.json());

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 🚨 THE WEBHOOK ENDPOINT
app.post('/webhooks/github', async (req: Request, res: Response) => {
  try {
    // 1. Extract GitHub headers
    const deliveryId = req.headers['x-github-delivery'] as string;
    const eventType  = req.headers['x-github-event']  as string;

    // Log EVERY arrival, before any branching
    console.log(`# 📨 Received ${eventType} (delivery ${deliveryId})`);

    // 2. Handle GitHub's initial "ping" test
    if (eventType === 'ping') {
      //console.log(`# ✅ Received GitHub PING for delivery ${deliveryId}`);
      return res.status(200).json({ message: 'Ping received' });
    }

    // 3. IDEMPOTENCY CHECK: Have we seen this delivery ID before?
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { deliveryId },
    });

    if (existingEvent) {
      console.log(`# ⚠️  Duplicate webhook detected: ${deliveryId}. Ignoring.`);
      return res.status(200).json({ message: 'Duplicate event ignored' });
    }

    // 4. Record the event to prevent future duplicates
    await prisma.webhookEvent.create({
      data: { deliveryId, event: eventType },
    });

    // 5. Process the Pull Request payload
    if (eventType === 'pull_request') {
      const payload = req.body;
      const prData = payload.pull_request;
      const repoData = payload.repository;

      // Upsert the Repository (Update if exists, Insert if new)
      const repo = await prisma.repository.upsert({
        where: { githubRepoId: repoData.id },
        update: {}, // No updates needed if it exists
        create: {
          githubRepoId: repoData.id,
          owner: repoData.owner.login,
          name: repoData.name,
        },
      });

      // Upsert the Pull Request
      const action = payload.action; // 'opened', 'closed', etc.
      let state = prData.state; // 'open' or 'closed'
      let mergedAt = prData.merged_at ? new Date(prData.merged_at) : null;

      // GitHub sets state to 'closed' when merged. We check merged_at to be sure.
      if (mergedAt) {
        state = 'merged';
      }

      await prisma.pullRequest.upsert({
        where: { githubPrId: prData.id },
        update: {
          state,
          mergedAt,
        },
        create: {
          githubPrId: prData.id,
          repositoryId: repo.id,
          number: prData.number,
          title: prData.title,
          author: prData.user.login,
          state,
          createdAt: new Date(prData.created_at),
          mergedAt,
        },
      });

      console.log(`# ✅ Processed PR #${prData.number} (${action}) for ${repo.owner}/${repo.name}`);
    }

    // 6. Always return 200 OK to GitHub immediately
    res.status(200).json({ message: 'Webhook processed' });

  } catch (error) {
    console.error('Webhook processing error:', error);
    // Even if we fail, return 200 so GitHub doesn't retry infinitely
    res.status(200).json({ message: 'Error processed, but acknowledged' });
  }
});

// Test Endpoint: Create a dummy repo to prove DB connection
app.post('/api/v1/test-repository', async (req: Request, res: Response) => {
  try {
    const repo = await prisma.repository.create({
      data: {
        githubRepoId: 123456789,
        owner: 'lesley-cyborg',
        name: 'test-repository',
      },
    });
    res.status(201).json(repo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create repository' });
  }
});



app.listen(port, () => {
    console.log('=====================================================');
    console.log('Olahh Sevara ya raga dah!');
    console.log('=====================================================');
    console.log(`## 🚀 DevPulse Server running on http://localhost:${port}`);
    console.log('=====================================================');
});