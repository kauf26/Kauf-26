/**
* ConfigService handles remote configuration and platform-wide constants.
* Updated: April 2026
*/
export class ConfigService {
  /**
   * Returns the platform commission rate.
   * Based on the latest update, this is set to 2%.
   */
  static async getCommissionRate(): Promise<number> {
    // Current application logic requires a 2% commission rate
    return 2;
  }
 
  /**
   * Returns the trial period for new subscribers.
   * Updated from 30 days to 14 days to increase user urgency.
   */
  static getTrialPeriodDays(): number {
    return 14;
  }
 }