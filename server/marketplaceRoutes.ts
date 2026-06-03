import express from 'express';
import { db } from './db'; // Adjust path if your initialized drizzle db instance is elsewhere
import { publishJobs, publishTasks } from '../shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// POST /api/marketplaces/publish
router.post('/publish', async (req, res) => {
 const { productData, marketplaceIds } = req.body;

 if (!productData || typeof productData !== 'object') {
   return res.status(400).json({ error: 'productData is required.' });
 }

 if (!marketplaceIds || !Array.isArray(marketplaceIds) || marketplaceIds.length === 0) {
   return res.status(400).json({ error: 'No target marketplaces provided.' });
 }

 try {
   // 1. Insert the master job using Drizzle
   const [newJob] = await db.insert(publishJobs)
     .values({
       productData: productData,
     })
     .returning();

   // 2. Insert individual tasks for each selected marketplace
   const taskValues = marketplaceIds.map((id) => ({
     jobId: newJob.id,
     marketplaceId: id,
     status: 'pending',
     attempts: 0,
   }));

   await db.insert(publishTasks).values(taskValues);

   return res.status(202).json({
     success: true,
     message: 'Publishing tasks queued.',
     jobId: newJob.id,
   });
 } catch (error: any) {
   console.error('Queue error:', error);
   return res.status(500).json({ error: 'Database error while queueing tasks.' });
 }
});

// GET /api/marketplaces/status/:jobId
router.get('/status/:jobId', async (req, res) => {
 const jobId = parseInt(req.params.jobId);

 try {
   // Fetch all tasks associated with this job
   const tasks = await db.select()
     .from(publishTasks)
     .where(eq(publishTasks.jobId, jobId));

   if (tasks.length === 0) {
     return res.status(404).json({ error: 'Job not found.' });
   }

   // Transform raw rows into the exact nested format your frontend expects
   const marketplaces: Record<string, string> = {};
   let allCompleted = true;
   let anyProcessingOrPending = false;

   tasks.forEach((task) => {
     marketplaces[task.marketplaceId] = task.status || 'pending';

     if (task.status !== 'completed' && task.status !== 'failed') {
       anyProcessingOrPending = true;
     }
   });

   // Determine the global parent status
   let parentStatus = 'processing';
   if (!anyProcessingOrPending) {
     parentStatus = 'completed';
   }

   return res.json({
     jobId,
     status: parentStatus,
     marketplaces,
   });
 } catch (error: any) {
   console.error('Status fetch error:', error);
   return res.status(500).json({ error: 'Failed to fetch job status.' });
 }
});

export default router;