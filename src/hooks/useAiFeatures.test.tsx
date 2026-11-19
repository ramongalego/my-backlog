import { renderHook } from '@testing-library/react';
import { useAiFeatures } from '@/hooks/useAiFeatures';

let profile: { ai_disabled?: boolean | null } | null = null;
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ profile }) }));

const on = () => renderHook(() => useAiFeatures()).result.current;

it('offers the AI features unless the player turned them off', () => {
  profile = { ai_disabled: false };
  expect(on()).toBe(true);
  profile = { ai_disabled: true };
  expect(on()).toBe(false);
});

it('offers them when the profile does not say, or is not there', () => {
  profile = { ai_disabled: null };
  expect(on()).toBe(true);
  profile = {};
  expect(on()).toBe(true);
  profile = null;
  expect(on()).toBe(true);
});
