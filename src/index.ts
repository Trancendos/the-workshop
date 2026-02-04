/**
 * the-workshop - Development, building, and creation space
 */

export class TheWorkshopService {
  private name = 'the-workshop';
  private _cachedStatus: Readonly<{ name: string; status: string }> | null = null;
  
  async start(): Promise<void> {
    console.log(`[${this.name}] Starting...`);
  }
  
  async stop(): Promise<void> {
    console.log(`[${this.name}] Stopping...`);
  }
  
  /**
   * Returns the service status.
   * Optimized to return a cached, frozen object to reduce memory allocation.
   */
  getStatus() {
    if (!this._cachedStatus) {
      this._cachedStatus = Object.freeze({ name: this.name, status: 'active' });
    }
    return this._cachedStatus;
  }
}

export default TheWorkshopService;

if (require.main === module) {
  const service = new TheWorkshopService();
  service.start();
}
