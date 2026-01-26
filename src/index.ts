/**
 * the-workshop - Development, building, and creation space
 */

export class TheWorkshopService {
  private name = 'the-workshop';
  
  // Cache the status object and freeze it to prevent mutations
  private readonly status = Object.freeze({ name: this.name, status: 'active' });

  async start(): Promise<void> {
    console.log(`[${this.name}] Starting...`);
  }
  
  async stop(): Promise<void> {
    console.log(`[${this.name}] Stopping...`);
  }
  
  getStatus() {
    return this.status;
  }
}

export default TheWorkshopService;

if (require.main === module) {
  const service = new TheWorkshopService();
  service.start();
}
