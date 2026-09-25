/** Map seed life-area sortOrder → monthly dimension codes. */
export const DIMENSION_BY_SORT_ORDER: Record<
  number,
  {
    code:
      | 'career'
      | 'ventures'
      | 'family'
      | 'health'
      | 'finance'
      | 'development'
      | 'relationships';
    nameIncludes: string[];
  }
> = {
  1: { code: 'career', nameIncludes: ['Career', 'Clinical'] },
  2: { code: 'ventures', nameIncludes: ['Venture', 'Innovation'] },
  3: { code: 'family', nameIncludes: ['Family'] },
  4: { code: 'health', nameIncludes: ['Health'] },
  5: { code: 'finance', nameIncludes: ['Finance'] },
  6: { code: 'development', nameIncludes: ['Personal Development', 'Development'] },
  7: { code: 'relationships', nameIncludes: ['Relationship', 'Network'] },
};

/** Weeks a dimension must stay low before imbalance callout. */
export const IMBALANCE_STREAK_WEEKS = 3;

/** Score01 below this counts as "low" for imbalance detection. */
export const IMBALANCE_LOW_THRESHOLD = 0.45;
