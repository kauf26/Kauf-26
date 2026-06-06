import { db } from './db';
import { publishJobs, publishTasks, productDrafts } from '../shared/schema';
import { eq, and, or, lt } from 'drizzle-orm';
import { processPublishTask, MAX_ATTEMPTS } from './queueManager';
import { draftToPublishPayload } from './publishToMarketplaces';
import { registerMarketplaceListing } from './services/inventoryService';

/** Exponential backoff before retrying failed tasks (ms). */
function retryBackoffMs(attempts: number): number {
  return Math.min(30_000, 1000 * Math.pow(2, Math.max(0, attempts - 1)));
}

function isReadyForRetry(
  status: string | null,
  attempts: number | null,
  updatedAt: Date | null
): boolean {
  if (status !== 'failed') return true;
  const a = attempts ?? 0;
  if (a >= MAX_ATTEMPTS) return false;
  const elapsed = Date.now() - (updatedAt?.getTime() ?? 0);
  return elapsed >= retryBackoffMs(a);
}

async function processQueue() {
 try {
   const [taskWithData] = await db
     .select({
       taskId: publishTasks.id,
       jobId: publishTasks.jobId,
       marketplaceId: publishTasks.marketplaceId,
       status: publishTasks.status,
       attempts: publishTasks.attempts,
       updatedAt: publishTasks.updatedAt,
       productData: publishJobs.productData,
     })
     .from(publishTasks)
     .innerJoin(publishJobs, eq(publishTasks.jobId, publishJobs.id))
     .where(
       or(
         eq(publishTasks.status, 'pending'),
         and(
           eq(publishTasks.status, 'failed'),
           lt(publishTasks.attempts, MAX_ATTEMPTS)
         )
       )
     )
     .limit(1)
     .for('update', { skipLocked: true });

   if (!taskWithData) return;

   if (
     !isReadyForRetry(
       taskWithData.status,
       taskWithData.attempts,
       taskWithData.updatedAt
     )
   ) {
     return;
   }

   const currentAttempts = (taskWithData.attempts ?? 0) + 1;

   await db
     .update(publishTasks)
     .set({
       status: 'processing',
       attempts: currentAttempts,
       updatedAt: new Date(),
     })
     .where(eq(publishTasks.id, taskWithData.taskId));

   const raw = taskWithData.productData as Record<string, unknown> | null;
   let draftPayload =
     raw && typeof raw === "object" && "draftId" in raw
       ? draftToPublishPayload({
           id: Number(raw.draftId),
           title: String(raw.title ?? ""),
           sku: (raw.sku as string | null) ?? null,
           images: raw.images,
           attributes: raw.attributes,
         })
       : null;

   if (draftPayload?.draftId) {
     const [freshDraft] = await db
       .select()
       .from(productDrafts)
       .where(eq(productDrafts.id, draftPayload.draftId));
     if (freshDraft) {
       draftPayload = draftToPublishPayload(freshDraft);
     }
   }

   try {
     const result = await processPublishTask({
       taskId: taskWithData.taskId,
       jobId: taskWithData.jobId,
       marketplaceId: taskWithData.marketplaceId,
       attempts: taskWithData.attempts ?? 0,
       draft:
         draftPayload ??
         draftToPublishPayload({
           id: 0,
           title: String((raw as { title?: string })?.title ?? "Unknown"),
           images: [],
           attributes: raw ?? {},
         }),
     });

     if (!result.success) {
       throw new Error(result.errorMessage ?? "Publish failed");
     }

     await db
       .update(publishTasks)
       .set({
         status: 'completed',
         errorMessage: result.dryRun ? "dry_run_no_credentials" : null,
         updatedAt: new Date(),
       })
       .where(eq(publishTasks.id, taskWithData.taskId));

     if (draftPayload?.draftId) {
       const [draft] = await db
         .select()
         .from(productDrafts)
         .where(eq(productDrafts.id, draftPayload.draftId));

       if (draft) {
         const attrs =
           draft.attributes && typeof draft.attributes === "object"
             ? { ...(draft.attributes as Record<string, unknown>) }
             : {};
         const posted = Array.isArray(attrs.postedTo)
           ? [...(attrs.postedTo as string[])]
           : [];
         if (!posted.includes(taskWithData.marketplaceId)) {
           posted.push(taskWithData.marketplaceId);
         }
         await db
           .update(productDrafts)
           .set({
             status: "posted",
             attributes: {
               ...attrs,
               postedTo: posted,
               postedAt: new Date().toISOString(),
               [`${taskWithData.marketplaceId}ListingId`]: result.listingId ?? null,
             },
             updatedAt: new Date(),
           })
           .where(eq(productDrafts.id, draftPayload.draftId));
       }

       try {
         await registerMarketplaceListing(
           draftPayload.draftId,
           taskWithData.marketplaceId,
           result.listingId ?? null,
           draftPayload.sku
         );
       } catch (invErr) {
         console.error(
           `[Worker] Inventory registration failed for ${taskWithData.marketplaceId}:`,
           invErr
         );
       }
     }

     console.log(`[Worker] Task ${taskWithData.taskId} completed for ${taskWithData.marketplaceId}`);
   } catch (uploadError: unknown) {
     const message =
       uploadError instanceof Error ? uploadError.message : "Unknown error";
     console.error(`[Worker] Task ${taskWithData.taskId} failed:`, message);

     await db
       .update(publishTasks)
       .set({
         status: 'failed',
         errorMessage: message,
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
