export class UnifiedService {
  private static readonly API_URL = 'https://api.unified.to';
 
  static async triggerSync(connectionId: string) {
    const apiKey = process.env.UNIFIED_API_KEY;
    if (!apiKey) {
      console.error("Unified API Key is missing");
      return null;
    }
 
    try {
      const response = await fetch(`${UnifiedService.API_URL}/unified/sync/${connectionId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      return await response.json();
    } catch (error) {
      console.error("Unified.to Sync Failed:", error);
      return null;
    }
  }
 
  static async listIntegrations() {
    const apiKey = process.env.UNIFIED_API_KEY;
    if (!apiKey) {
      console.error("Unified API Key is missing");
      return null;
    }
 
    try {
      const response = await fetch(`${UnifiedService.API_URL}/unified/integration`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Failed to fetch integrations:", error);
      return null;
    }
  }
 }
 