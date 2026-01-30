import { describe, it, expect } from 'vitest';
import { TheWorkshopService } from './index';

describe('TheWorkshopService', () => {
  it('getStatus returns correct structure', () => {
    const service = new TheWorkshopService();
    const status = service.getStatus();
    expect(status).toEqual({ name: 'the-workshop', status: 'active' });
  });

  it('getStatus returns the same cached object reference (optimized)', () => {
    const service = new TheWorkshopService();
    const status1 = service.getStatus();
    const status2 = service.getStatus();
    // Optimization: returns same reference
    expect(status1).toBe(status2);
    expect(status1).toEqual(status2);
  });
});
