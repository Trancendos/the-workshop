import { describe, it, expect } from 'vitest';
import { TheWorkshopService } from './index';

describe('TheWorkshopService', () => {
  it('should return status', () => {
    const service = new TheWorkshopService();
    const status = service.getStatus();
    expect(status).toEqual({ name: 'the-workshop', status: 'active' });
  });

  it('should return same frozen object on each call (optimized behavior)', () => {
    const service = new TheWorkshopService();
    const status1 = service.getStatus();
    const status2 = service.getStatus();
    // Optimized: returns cached object
    expect(status1).toBe(status2);
    expect(status1).toEqual(status2);
    expect(Object.isFrozen(status1)).toBe(true);
  });
});
