import {
  MOOD_QUESTION,
  ENERGY_QUESTION,
  TIME_QUESTION,
  QUESTIONS,
} from '@/lib/suggest/questions';

describe('questions configuration', () => {
  describe('MOOD_QUESTION', () => {
    it('should have 4 mood options', () => {
      expect(MOOD_QUESTION.options).toHaveLength(4);
    });

    it('should have all expected mood values', () => {
      const values = MOOD_QUESTION.options.map(o => o.value);

      expect(values).toContain('adrenaline');
      expect(values).toContain('relaxed');
      expect(values).toContain('engaged');
      expect(values).toContain('emotional');
    });

    it('should have emoji for each option', () => {
      MOOD_QUESTION.options.forEach(option => {
        expect(option.emoji).toBeTruthy();
        expect(option.emoji.length).toBeGreaterThan(0);
      });
    });

    it('should have label and description for each option', () => {
      MOOD_QUESTION.options.forEach(option => {
        expect(option.label).toBeTruthy();
        expect(option.description).toBeTruthy();
      });
    });
  });

  describe('ENERGY_QUESTION', () => {
    it('should have 3 energy options', () => {
      expect(ENERGY_QUESTION.options).toHaveLength(3);
    });

    it('should have all expected energy values', () => {
      const values = ENERGY_QUESTION.options.map(o => o.value);

      expect(values).toContain('high');
      expect(values).toContain('medium');
      expect(values).toContain('low');
    });
  });

  describe('TIME_QUESTION', () => {
    it('should have 3 time options', () => {
      expect(TIME_QUESTION.options).toHaveLength(3);
    });

    it('should have all expected time values', () => {
      const values = TIME_QUESTION.options.map(o => o.value);

      expect(values).toContain('short');
      expect(values).toContain('medium');
      expect(values).toContain('long');
    });
  });

  describe('QUESTIONS array', () => {
    it('should have 3 questions in correct order', () => {
      expect(QUESTIONS).toHaveLength(3);
      expect(QUESTIONS[0].id).toBe('mood');
      expect(QUESTIONS[1].id).toBe('energy');
      expect(QUESTIONS[2].id).toBe('time');
    });
  });
});
