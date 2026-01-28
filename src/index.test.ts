import { expect, test, describe } from 'vitest';
import { TheWorkshopService } from './index';

describe('TheWorkshopService', () => {
  test('getStatus returns correct initial status', () => {
    const service = new TheWorkshopService();
    const status = service.getStatus();
    expect(status).toEqual({ name: 'the-workshop', status: 'active' });
  });

  test('getStatus returns the same object reference', () => {
    const service = new TheWorkshopService();
    const s1 = service.getStatus();
    const s2 = service.getStatus();
    expect(s1).toBe(s2);
  });

  test('getStatus object is frozen', () => {
    const service = new TheWorkshopService();
    const status = service.getStatus();
    expect(Object.isFrozen(status)).toBe(true);
  });
});
