/**
 * the-workshop - Development, building, and creation space
 */

export class TheWorkshopService {
  private readonly name = 'the-workshop';
  // Optimization: Cache the status object to prevent object allocation on every call
  private readonly cachedStatus = Object.freeze({ name: this.name, status: 'active' });
  
  async start(): Promise<void> {
    console.log(`[${this.name}] Starting...`);
  }
  
  async stop(): Promise<void> {
    console.log(`[${this.name}] Stopping...`);
  }
  
  getStatus() {
    return this.cachedStatus;
  }
}

export default TheWorkshopService;

if (require.main === module) {
  const service = new TheWorkshopService();
  service.start();
}
