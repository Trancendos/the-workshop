/**
 * the-workshop - Development, building, and creation space
 */

export class TheWorkshopService {
  private name = 'the-workshop';
  
  async start(): Promise<void> {
    console.log(`[${this.name}] Starting...`);
  }
  
  async stop(): Promise<void> {
    console.log(`[${this.name}] Stopping...`);
  }
  
  // Optimization: Cache status object lazily to avoid allocation on every call
  private _status: { name: string; status: string } | undefined;

  getStatus() {
    if (!this._status) {
      this._status = Object.freeze({ name: this.name, status: 'active' });
    }
    return this._status;
  }
}

export default TheWorkshopService;

if (require.main === module) {
  const service = new TheWorkshopService();
  service.start();
}
