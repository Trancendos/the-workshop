import { describe, it, expect } from 'vitest';
import { TheWorkshopService } from './index';

describe('TheWorkshopService', () => {
  it('should provide default status', () => {
    const service = new TheWorkshopService();
    expect(service.getStatus()).toEqual({
      name: 'the-workshop',
      status: 'active'
    });
  });
});
