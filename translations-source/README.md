# translations-source

Single source of truth for all ShiftWork i18n strings. Both the Angular web app and the React Native mobile app consume the same `strings.json`.

## Structure

```
translations-source/
├── strings.json               ← edit here
├── package.json
└── scripts/
    ├── validate-strings.js    ← CI gate
    ├── generate-rn-translations.js
    └── generate-angular-xliff.js
```

**Generated output** (committed alongside source changes):

| File | Target project |
|---|---|
| `ShiftWork.Mobile/i18n/translations/en.ts` | React Native |
| `ShiftWork.Mobile/i18n/translations/es.ts` | React Native |
| `ShiftWork.Angular/src/locale/messages.xlf` | Angular |
| `ShiftWork.Angular/src/locale/messages.es.xlf` | Angular |

## Adding or editing strings

1. Open `strings.json`.
2. Add or update a key using the namespace pattern `"feature.screen.element"`:

```json
"schedule.empty_state": {
  "en": "No shifts scheduled.",
  "es": "No hay turnos programados."
}
```

3. For variables use `{{variableName}}` — must match between `en` and `es`.
4. For plurals add `_one` / `_other` sibling keys:

```json
"bulletins.unread_one":   { "en": "{{count}} unread bulletin",  "es": "{{count}} boletín sin leer" },
"bulletins.unread_other": { "en": "{{count}} unread bulletins", "es": "{{count}} boletines sin leer" }
```

## Running the pipeline

```bash
cd translations-source

# 1. Validate (exits 1 with errors if something is wrong)
npm run validate

# 2. Generate both platforms at once (runs validate first)
npm run generate:all

# Or individually:
npm run generate:rn       # → ShiftWork.Mobile/i18n/translations/
npm run generate:angular  # → ShiftWork.Angular/src/locale/
```

## Angular usage

Templates use `@@id` custom IDs that match the JSON key:

```html
<h1 i18n="@@auth.login.title">Sign In</h1>
<label i18n="@@auth.login.email_label">Email address</label>
```

TypeScript strings use `$localize`:

```typescript
import '@angular/localize/init';
const msg = $localize`:@@auth.onboarding.sandbox_hidden_ok:Sandbox data has been hidden.`;
```

Build Spanish locale:

```bash
cd ShiftWork.Angular
ng build --configuration=es-SP            # Spanish only
ng build --configuration=production       # English only
```

## React Native usage

```tsx
import { useTranslation } from '@/i18n';

function LoginScreen() {
  const { t } = useTranslation();
  return <Text>{t('auth.login.title')}</Text>;
}
```

With variables:

```tsx
t('auth.login.biometric', { biometricType: 'Face ID' })
// → "Sign in with Face ID"
```

Change locale at runtime (e.g. from a settings screen):

```tsx
const { locale, setLocale } = useTranslation();
await setLocale('es');
```

## CI integration

Add to your GitHub Actions workflow before the build step:

```yaml
- name: Validate translations
  run: cd translations-source && npm run validate
```
