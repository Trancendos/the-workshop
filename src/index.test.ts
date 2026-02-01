import { describe, it, expect } from 'vitest';
import { TheWorkshopService } from './index';

describe('TheWorkshopService', () => {
  it('getStatus returns correct status', () => {
    const service = new TheWorkshopService();
    const status = service.getStatus();
    expect(status).toEqual({ name: 'the-workshop', status: 'active' });
  });

  it('getStatus returns cached object reference (optimized)', () => {
    const service = new TheWorkshopService();
    const status1 = service.getStatus();
    const status2 = service.getStatus();

    // Performance optimization: verify we get the exact same object reference
    expect(status1).toBe(status2);
    expect(status1).toEqual(status2);
  });

  it('getStatus returns frozen object', () => {
    const service = new TheWorkshopService();
    const status = service.getStatus();
    expect(Object.isFrozen(status)).toBe(true);
  });
});
