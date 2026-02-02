/**
 * the-workshop - Development, building, and creation space
 */

export class TheWorkshopService {
  private readonly name = 'the-workshop';

  // Cache the status object to avoid allocation on every call.
  // Using Object.freeze to ensure immutability since we're returning a shared reference.
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
