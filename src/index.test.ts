import { describe, it, expect } from 'vitest';
import { TheWorkshopService } from './index';

describe('TheWorkshopService', () => {
  it('getStatus returns correct initial status', () => {
    const service = new TheWorkshopService();
    const status = service.getStatus();
    expect(status).toEqual({ name: 'the-workshop', status: 'active' });
  });

  it('getStatus returns the same object reference', () => {
    const service = new TheWorkshopService();
    const s1 = service.getStatus();
    const s2 = service.getStatus();
    expect(s1).toBe(s2);
  });

  it('getStatus returns a frozen object', () => {
    const service = new TheWorkshopService();
    const status = service.getStatus();
    expect(Object.isFrozen(status)).toBe(true);
  });
});
