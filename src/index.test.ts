import { describe, it, expect } from 'vitest';
import { TheWorkshopService } from './index';

describe('TheWorkshopService', () => {
  it('should return default status', () => {
    const service = new TheWorkshopService();
    const status = service.getStatus();
    expect(status).toEqual({ name: 'the-workshop', status: 'active' });
  });

  it('should start and stop without error', async () => {
    const service = new TheWorkshopService();
    await expect(service.start()).resolves.toBeUndefined();
    await expect(service.stop()).resolves.toBeUndefined();
  });

  it('should return stable status object instance', () => {
    const service = new TheWorkshopService();
    const status1 = service.getStatus();
    const status2 = service.getStatus();
    expect(status1).toBe(status2);
    expect(Object.isFrozen(status1)).toBe(true);
  });
});
