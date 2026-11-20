import dashboardRouter from './routes/dashboard';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import prisma from './prismaClient';

// 1. Extend Express Request type to include rawBody
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

const app = express();
const port: number = Number(process.env.PORT) || 3001;
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'my_super_secret_devpulse_key_123';

app.use(cors());

// 2. BULLETPROOF MIDDLEWARE: Captures raw bytes AND parses JSON safely
app.use((req: any, res: Response, next: NextFunction) => {
  let rawData = '';
  req.setEncoding('utf8');
  req.on('data', (chunk: string) => {
    rawData += chunk;
  });
  req.on('end', () => {
    // Store the EXACT raw string for HMAC verification
    req.rawBody = Buffer.from(rawData, 'utf8');
    
    try {
      let jsonString = rawData;
      
      // Defensive check: GitHub sometimes sends form-urlencoded despite settings
      if (rawData.startsWith('payload=')) {
        console.warn('⚠️ Webhook received as form-urlencoded. Decoding...');
        // 1. Strip "payload="
        const encodedPayload = rawData.substring(8);
        // 2. Decode the URL-encoded string (e.g., %7B becomes { )
        jsonString = decodeURIComponent(encodedPayload);
      }
      
      req.body = jsonString ? JSON.parse(jsonString) : {};
    } catch (err) {
      console.error('❌ Failed to parse webhook body as JSON:', err);
      req.body = {}; 
    }
    next();
  });
});

app.use('/api/v1', dashboardRouter);

// 3. HMAC Signature Verification Middleware
const verifyGitHubSignature = (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  
  if (!signature) {
    console.error('❌ Missing x-hub-signature-256 header');
    return res.status(401).json({ error: 'Missing signature' });
  }

  // Safeguard: ensure rawBody actually exists
  if (!req.rawBody) {
    console.error('❌ req.rawBody is undefined. Middleware failed to capture stream.');
    return res.status(500).json({ error: 'Internal server error' });
  }

  // GitHub sends: sha256=<hex_hash>
  const providedHash = signature.split('=')[1];
  
  // Compute our own hash using the raw body and our secret
  const expectedHash = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(providedHash, 'hex'),
    Buffer.from(expectedHash, 'hex')
  );

  if (!isMatch) {
    console.error('❌ Invalid webhook signature. Possible spoofing attempt.');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next(); // Signature is valid, proceed to route handler
};

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 4. THE SECURE WEBHOOK ENDPOINT
app.post('/webhooks/github', verifyGitHubSignature, async (req: Request, res: Response) => {
  try {
    const deliveryId = req.headers['x-github-delivery'] as string;
    const eventType = req.headers['x-github-event'] as string;

    console.log(`📨 Received ${eventType} (delivery ${deliveryId})`);

    if (eventType === 'ping') {
      console.log(`✅ Received GitHub PING for delivery ${deliveryId}`);
      return res.status(200).json({ message: 'Ping received' });
    }

    // IDEMPOTENCY CHECK
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { deliveryId },
    });

    if (existingEvent) {
      console.log(`⚠️ Duplicate webhook detected: ${deliveryId}. Ignoring.`);
      return res.status(200).json({ message: 'Duplicate event ignored' });
    }

    await prisma.webhookEvent.create({
      data: { deliveryId, event: eventType },
    });

    // PROCESS PULL REQUEST
    if (eventType === 'pull_request') {
      const payload = req.body;
      const prData = payload.pull_request;
      const repoData = payload.repository;

      const repo = await prisma.repository.upsert({
        where: { githubRepoId: BigInt(repoData.id) },
        update: {},
        create: {
          githubRepoId: BigInt(repoData.id),
          owner: repoData.owner.login,
          name: repoData.name,
        },
      });

      const action = payload.action;
      let state = prData.state;
      let mergedAt = prData.merged_at ? new Date(prData.merged_at) : null;

      if (mergedAt) state = 'merged';

      await prisma.pullRequest.upsert({
        where: { githubPrId: BigInt(prData.id) },
        update: { state, mergedAt },
        create: {
          githubPrId: BigInt(prData.id),
          repositoryId: repo.id,
          number: prData.number,
          title: prData.title,
          author: prData.user.login,
          state,
          createdAt: new Date(prData.created_at),
          mergedAt,
        },
      });

      console.log(`✅ Processed PR #${prData.number} (${action}) for ${repo.owner}/${repo.name}`);
    }

    res.status(200).json({ message: 'Webhook processed securely' });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    // Senior pattern: Return 200 to prevent GitHub poison-pill retries
    res.status(200).json({ message: 'Error processed, but acknowledged' });
  }
});

// 5. THE SECURITY GATE ENDPOINT (Simulates CI/CD Secret Scanner)
app.post('/api/v1/security-scan', async (req: Request, res: Response) => {
  try {
    const { githubPrId, severity, description } = req.body;

    if (!githubPrId || !severity || !description) {
      return res.status(400).json({ error: 'Missing required fields: githubPrId, severity, description' });
    }

    const pr = await prisma.pullRequest.findUnique({
      where: { githubPrId: BigInt(githubPrId) },
    });

    if (!pr) {
      return res.status(404).json({ error: 'Pull Request not found' });
    }

    await prisma.securityEvent.create({
      data: {
        pullRequestId: pr.id,
        severity,
        description,
      },
    });

    let newSecurityStatus = pr.securityStatus;
    if (severity === 'high') {
      newSecurityStatus = 'blocked';
      await prisma.pullRequest.update({
        where: { id: pr.id },
        data: { securityStatus: 'blocked' },
      });
      console.log(`🚨 SECURITY GATE: PR #${pr.number} blocked due to HIGH severity issue.`);
    }

    res.status(200).json({ 
      message: 'Security scan recorded', 
      prId: pr.id, 
      newStatus: newSecurityStatus 
    });

  } catch (error) {
    console.error('❌ Security scan processing error:', error);
    res.status(500).json({ error: 'Failed to process security scan' });
  }
});

app.listen(port, () => {
    console.log('=====================================================');
    console.log('🖥️  Internal Developer Portal Backend ');
    console.log('=====================================================');
    console.log(`🚀 DevPulse Server running on http://localhost:${port}`);
    console.log('=====================================================');
});