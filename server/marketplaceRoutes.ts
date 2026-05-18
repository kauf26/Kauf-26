import express from 'express';
import { pool } from './db'; // your Postgres pool

const router = express.Router();

// POST /api/marketplaces/publish
router.post('/publish', async (req, res) => {
 const { productData, marketplaceIds } = req.body;

 if (!marketplaceIds || !Array.isArray(marketplaceIds) || marketplaceIds.length === 0) {
   return res.status(400).json({ error: 'No target marketplaces provided.' });
 }

 const client = await pool.connect();
 try {
   await client.query('BEGIN');

   // Insert master job
   const jobResult = await client.query(
     `INSERT INTO publish_jobs (product_data) VALUES ($1) RETURNING id`,
     [JSON.stringify(productData)]
   );
   const jobId = jobResult.rows[0].id;

   // Insert individual tasks for each marketplace
   for (const marketplaceId of marketplaceIds) {
     await client.query(
       `INSERT INTO publish_tasks (job_id, marketplace_id, status, attempts)
        VALUES ($1, $2, 'pending', 0)`,
       [jobId, marketplaceId]
     );
   }

   await client.query('COMMIT');

   return res.status(202).json({
     success: true,
     message: 'Publishing tasks queued.',
     jobId,
   });
 } catch (error: any) {
   await client.query('ROLLBACK');
   console.error('Queue error:', error);
   return res.status(500).json({ error: 'Database error while queuing tasks.' });
 } finally {
   client.release();
 }
});

// GET /api/marketplaces/status/:jobId
router.get('/status/:jobId', async (req, res) => {
 const { jobId } = req.params;

 try {
   const result = await pool.query(
     `SELECT marketplace_id, status, error_message
      FROM publish_tasks
      WHERE job_id = $1`,
     [jobId]
   );

   return res.json({
     success: true,
     tasks: result.rows,
   });
 } catch (error: any) {
   console.error('Status fetch error:', error);
   return res.status(500).json({ error: 'Failed to fetch job status.' });
 }
});

export default router;