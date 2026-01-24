import { describe, it, expect } from 'vitest';
import { TheWorkshopService } from './index';

describe('TheWorkshopService', () => {
  it('should initialize with correct name', () => {
    const service = new TheWorkshopService();
    const status = service.getStatus();
    expect(status).toEqual({ name: 'the-workshop', status: 'active' });
  });

  it('should start without error', async () => {
    const service = new TheWorkshopService();
    await expect(service.start()).resolves.toBeUndefined();
  });

  it('should stop without error', async () => {
    const service = new TheWorkshopService();
    await expect(service.stop()).resolves.toBeUndefined();
  });
});
