import express from 'express';
import { db } from './db';
import { publishJobs, publishTasks } from '../shared/schema';
import { eq } from 'drizzle-orm';
import {
  MASTER_MARKETPLACES,
  resolveMarketplaceTargets,
  getEnabledMarketplaceIds,
} from './config/marketplaces';
import { publishDraft, publishDraftToAll } from './services/publishEngine';
import { marketplaceEnvConfigured } from './services/marketplaceCredentials';

const router = express.Router();

// POST /api/marketplaces/publish
// Body: { draftId, marketplaces?: string[], marketplaceIds?: string[], sync?: boolean }
router.post('/publish', async (req, res) => {
 const { draftId, marketplaces, marketplaceIds, sync } = req.body;

 if (draftId == null || Number.isNaN(Number(draftId))) {
   return res.status(400).json({ error: 'draftId is required.' });
 }

 const requested = Array.isArray(marketplaces)
   ? marketplaces
   : Array.isArray(marketplaceIds)
     ? marketplaceIds
     : undefined;

 const targets = resolveMarketplaceTargets(requested);
 if (targets.length === 0) {
   return res.status(400).json({
     error: 'No enabled marketplaces provided.',
   });
 }

 try {
   const report = await publishDraft(Number(draftId), targets, {
     sync: sync === true,
     createJob: true,
   });

   return res.status(202).json({
     success: true,
     message: sync
       ? 'Publishing completed.'
       : 'Publishing tasks queued.',
     jobId: report.jobId,
     draftId: report.draftId,
     marketplaces: report.marketplaces,
     outcomes: report.outcomes,
     succeeded: report.succeeded,
     failed: report.failed,
     dryRun: report.dryRun,
   });
 } catch (error: unknown) {
   const message = error instanceof Error ? error.message : 'Queue error';
   console.error('[Marketplaces] publish error:', error);
   if (message.includes('not found')) {
     return res.status(404).json({ error: message });
   }
   if (message.includes('does not support category')) {
     return res.status(400).json({ error: message });
   }
   return res.status(500).json({ error: message });
 }
});

// GET /api/marketplaces/status/:jobId
router.get('/status/:jobId', async (req, res) => {
 const jobId = parseInt(req.params.jobId);

 try {
   const tasks = await db.select()
     .from(publishTasks)
     .where(eq(publishTasks.jobId, jobId));

   if (tasks.length === 0) {
     return res.status(404).json({ error: 'Job not found.' });
   }

   const marketplaces: Record<string, string> = {};
   const details: Record<string, { status: string; error?: string | null }> = {};
   let anyProcessingOrPending = false;
   let failed = 0;
   let completed = 0;

   tasks.forEach((task) => {
     const status = task.status || 'pending';
     marketplaces[task.marketplaceId] = status;
     details[task.marketplaceId] = {
       status,
       error: task.errorMessage,
     };

     if (status === 'completed') completed++;
     if (status === 'failed') failed++;
     if (status !== 'completed' && status !== 'failed') {
       anyProcessingOrPending = true;
     }
   });

   let parentStatus = 'processing';
   if (!anyProcessingOrPending) {
     parentStatus = failed > 0 && completed === 0 ? 'failed' : 'completed';
   }

   return res.json({
     jobId,
     status: parentStatus,
     marketplaces,
     details,
     summary: { completed, failed, total: tasks.length },
   });
 } catch (error: unknown) {
   console.error('Status fetch error:', error);
   return res.status(500).json({ error: 'Failed to fetch job status.' });
 }
});

// POST /api/marketplaces/publish-all
// Body: { draftId, sync?: boolean }
router.post('/publish-all', async (req, res) => {
  const { draftId, sync } = req.body;

  if (draftId == null || Number.isNaN(Number(draftId))) {
    return res.status(400).json({ error: 'draftId is required.' });
  }

  try {
    const report = await publishDraftToAll(Number(draftId), {
      sync: sync === true,
      createJob: true,
    });

    return res.status(202).json({
      success: true,
      message: sync
        ? `Publishing completed to ${report.marketplaces.length} marketplaces.`
        : `Publishing queued for ${report.marketplaces.length} marketplaces.`,
      jobId: report.jobId,
      draftId: report.draftId,
      imagesProcessed: undefined,
      marketplaces: report.marketplaces,
      outcomes: report.outcomes,
      succeeded: report.succeeded,
      failed: report.failed,
      dryRun: report.dryRun,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Queue error';
    console.error('[Marketplaces] publish-all error:', error);
    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }
    if (
      message.includes('does not support category') ||
      message.includes('No enabled marketplaces support category')
    ) {
      return res.status(400).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
});

// GET /api/marketplaces/config
router.get('/config', (_req, res) => {
  return res.json({
    marketplaces: MASTER_MARKETPLACES.map((m) => ({
      ...m,
      envConfigured: marketplaceEnvConfigured(m.id),
    })),
    enabledCount: getEnabledMarketplaceIds().length,
  });
});

export default router;
