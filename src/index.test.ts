import { describe, it, expect } from 'vitest';
import { TheWorkshopService } from './index';

describe('TheWorkshopService', () => {
  it('should return correct status', () => {
    const service = new TheWorkshopService();
    const status = service.getStatus();

    expect(status).toEqual({
      name: 'the-workshop',
      status: 'active'
    });
  });

  it('should return the same object reference', () => {
    const service = new TheWorkshopService();
    const status1 = service.getStatus();
    const status2 = service.getStatus();

    expect(status1).toBe(status2);
  });

  it('should return a frozen object', () => {
    const service = new TheWorkshopService();
    const status = service.getStatus();

    expect(Object.isFrozen(status)).toBe(true);
  });
});
