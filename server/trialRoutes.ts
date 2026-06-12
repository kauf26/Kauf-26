import express from "express";
import {
  getTrialStatus,
  parseTrialStartDate,
} from "../shared/trialStatus";

const router = express.Router();

function readTrialStartDate(): Date {
  return parseTrialStartDate(process.env.TRIAL_START_DATE);
}

router.get("/status", (_req, res) => {
  const trialStartDate = readTrialStartDate();
  const status = getTrialStatus(trialStartDate);
  return res.status(200).json(status);
});

export { router as trialRoutes };
