import { db } from './db'; // Adjust path if your initialized drizzle db instance is elsewhere
import { publishJobs, publishTasks } from '../shared/schema';
import { eq, and, or, lt } from 'drizzle-orm';

// Stub publisher — replace with eBay/Depop/etc. adapters later
async function executeMarketplaceUpload(marketplaceId: string, productData: unknown) {
 console.log(`[Worker] STUB publish → marketplace: ${marketplaceId}`);
 console.log(
   `[Worker] Listing payload (job productData):`,
   JSON.stringify(productData, null, 2)
 );
 await new Promise((resolve) => setTimeout(resolve, 500));
 console.log(`[Worker] STUB completed upload to ${marketplaceId}`);
}

async function processQueue() {
 try {
   // 1. Fetch one pending or retryable task using Drizzle with a row-level lock
   // This perfectly mirrors your raw SQL: FOR UPDATE SKIP LOCKED
   const [taskWithData] = await db
     .select({
       taskId: publishTasks.id,
       jobId: publishTasks.jobId,
       marketplaceId: publishTasks.marketplaceId,
       status: publishTasks.status,
       attempts: publishTasks.attempts,
       productData: publishJobs.productData,
     })
     .from(publishTasks)
     .innerJoin(publishJobs, eq(publishTasks.jobId, publishJobs.id))
     .where(
       or(
         eq(publishTasks.status, 'pending'),
         and(
           eq(publishTasks.status, 'failed'),
           lt(publishTasks.attempts, 3)
         )
       )
     )
     .limit(1)
     .for('update', { skipLocked: true });

   // If no tasks are waiting in the queue, quietly return and wait for the next interval
   if (!taskWithData) return;

   const currentAttempts = (taskWithData.attempts ?? 0) + 1;

   // 2. Mark the task as processing and bump the attempt counter
   await db
     .update(publishTasks)
     .set({
       status: 'processing',
       attempts: currentAttempts,
       updatedAt: new Date(),
     })
     .where(eq(publishTasks.id, taskWithData.taskId));

   try {
     // 3. Run the actual marketplace background upload
     await executeMarketplaceUpload(taskWithData.marketplaceId, taskWithData.productData);

     // 4. On Success: mark as completed
     await db
       .update(publishTasks)
       .set({
         status: 'completed',
         errorMessage: null,
         updatedAt: new Date(),
       })
       .where(eq(publishTasks.id, taskWithData.taskId));

     console.log(`[Worker] Task ${taskWithData.taskId} completed for ${taskWithData.marketplaceId}`);
   } catch (uploadError: any) {
     console.error(`[Worker] Task ${taskWithData.taskId} failed:`, uploadError.message);

     // 5. On Failure: mark as failed and log the error message
     await db
       .update(publishTasks)
       .set({
         status: 'failed',
         errorMessage: uploadError.message || 'Unknown error',
         updatedAt: new Date(),
       })
       .where(eq(publishTasks.id, taskWithData.taskId));
   }
 } catch (queueError) {
   console.error('[Worker] Queue processing error:', queueError);
 }
}

export function startMarketplaceWorker() {
 console.log('[Worker] Started. Polling every 10 seconds...');
 setInterval(async () => {
   await processQueue();
 }, 10000);
}
