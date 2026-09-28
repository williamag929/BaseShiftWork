import en from '../translations/en';
import es from '../translations/es';

type Dict = Record<string, unknown>;

function collectKeys(obj: Dict, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object'
      ? collectKeys(value as Dict, path)
      : [path];
  });
}

function collectPlaceholders(text: string): string[] {
  return [...text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1]).sort();
}

function getByPath(obj: Dict, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, key) => (acc as Dict | undefined)?.[key as keyof Dict],
    obj
  );
}

describe('translation key parity EN↔ES', () => {
  const enKeys = collectKeys(en as unknown as Dict).sort();
  const esKeys = collectKeys(es as unknown as Dict).sort();

  it('es has every en key', () => {
    const missing = enKeys.filter((k) => !esKeys.includes(k));
    expect(missing).toEqual([]);
  });

  it('en has every es key', () => {
    const extra = esKeys.filter((k) => !enKeys.includes(k));
    expect(extra).toEqual([]);
  });

  it('every value is a non-empty string', () => {
    for (const key of enKeys) {
      expect(typeof getByPath(en as unknown as Dict, key)).toBe('string');
      expect((getByPath(en as unknown as Dict, key) as string).length).toBeGreaterThan(0);
    }
    for (const key of esKeys) {
      expect(typeof getByPath(es as unknown as Dict, key)).toBe('string');
      expect((getByPath(es as unknown as Dict, key) as string).length).toBeGreaterThan(0);
    }
  });

  it('{{placeholders}} match between en and es', () => {
    const mismatches: string[] = [];
    for (const key of enKeys) {
      const enVal = getByPath(en as unknown as Dict, key);
      const esVal = getByPath(es as unknown as Dict, key);
      if (typeof enVal !== 'string' || typeof esVal !== 'string') continue;
      if (collectPlaceholders(enVal).join(',') !== collectPlaceholders(esVal).join(',')) {
        mismatches.push(key);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
