/**
 * the-workshop - Development, building, and creation space
 */

export class TheWorkshopService {
  private name = 'the-workshop';

  // Cache status object to prevent allocation on every call and reduce GC pressure.
  // Frozen to ensure immutability since it is shared.
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
