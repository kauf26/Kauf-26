import { pool } from './db';

// Simulate actual upload to a marketplace – replace with your real API/Puppeteer logic
async function executeMarketplaceUpload(marketplaceId: string, productData: any) {
 console.log(`[Worker] Uploading to ${marketplaceId}...`);
 // Simulate work (remove this and add real integration)
 await new Promise(resolve => setTimeout(resolve, 2000));

 // Example real dispatch:
 // switch (marketplaceId) {
 //   case 'depop': await depopApi.createListing(productData); break;
 //   case 'ebay': await ebayApi.createListing(productData); break;
 //   default: throw new Error(`No handler for ${marketplaceId}`);
 // }
}

async function processQueue() {
 const client = await pool.connect();
 try {
   // Fetch one pending or retryable task with row-level lock
   const selectQuery = `
     SELECT pt.*, pj.product_data
     FROM publish_tasks pt
     JOIN publish_jobs pj ON pt.job_id = pj.id
     WHERE (pt.status = 'pending' OR (pt.status = 'failed' AND pt.attempts < 3))
       AND pt.updated_at < NOW() - INTERVAL '5 minutes' * pt.attempts
     LIMIT 1
     FOR UPDATE OF pt SKIP LOCKED
   `;
   const result = await client.query(selectQuery);
   if (result.rows.length === 0) return;

   const task = result.rows[0];
   const productData = task.product_data;

   // Mark as processing
   await client.query(
     `UPDATE publish_tasks
      SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
      WHERE id = $1`,
     [task.id]
   );

   try {
     // Perform the actual upload
     await executeMarketplaceUpload(task.marketplace_id, productData);

     // Success
     await client.query(
       `UPDATE publish_tasks
        SET status = 'completed', error_message = NULL, updated_at = NOW()
        WHERE id = $1`,
       [task.id]
     );
     console.log(`[Worker] Task ${task.id} completed for ${task.marketplace_id}`);
   } catch (err: any) {
     console.error(`[Worker] Task ${task.id} failed:`, err.message);
     await client.query(
       `UPDATE publish_tasks
        SET status = 'failed', error_message = $1, updated_at = NOW()
        WHERE id = $2`,
       [err.message || 'Unknown error', task.id]
     );
   }
 } catch (err) {
   console.error('[Worker] Queue processing error:', err);
 } finally {
   client.release();
 }
}

export function startMarketplaceWorker() {
 console.log('[Worker] Started. Polling every 10 seconds...');
 setInterval(async () => {
   await processQueue();
 }, 10000);
}