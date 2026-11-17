/**
 * @jest-environment node
 */
import { isOutOfBudget } from '@/lib/server/ai-model';

/** An error as the OpenAI SDK throws one. */
const refusal = (fields: Record<string, unknown>) =>
  Object.assign(new Error('refused'), { status: 429, ...fields });

describe('isOutOfBudget', () => {
  it.each([
    'project_spend_limit_exceeded',
    'organization_spend_limit_exceeded',
    'credit_balance_exhausted',
    'insufficient_quota',
    'billing_hard_limit_reached',
  ])('is true when OpenAI refuses with %s', (code) => {
    expect(isOutOfBudget(refusal({ code }))).toBe(true);
  });

  it('reads the code from the error type too, where older errors carry it', () => {
    expect(isOutOfBudget(refusal({ code: null, type: 'insufficient_quota' }))).toBe(true);
  });

  it('is false for a rate limit, which is a 429 as well but passes', () => {
    expect(isOutOfBudget(refusal({ code: 'rate_limit_exceeded', type: 'requests' }))).toBe(false);
  });

  it('is false for anything else that goes wrong', () => {
    expect(isOutOfBudget(new Error('timeout'))).toBe(false);
    expect(isOutOfBudget(refusal({ status: 500, code: 'server_error' }))).toBe(false);
    expect(isOutOfBudget(null)).toBe(false);
    expect(isOutOfBudget('insufficient_quota')).toBe(false);
    expect(isOutOfBudget({ code: 42 })).toBe(false);
  });
});
