import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { peopleService } from '@/services/people.service';
import { companySettingsService } from '@/services/company-settings.service';
import { useTranslation } from '@/i18n';

/**
 * Applies the server-side language resolution chain after login:
 * Person.PreferredLanguage → CompanySettings.DefaultLanguage.
 * No-op when the user has already picked a language in-app.
 */
export function useServerLocale(): void {
  const { companyId, personId } = useAuthStore();
  const { applyServerLocale } = useTranslation();

  useEffect(() => {
    if (!companyId || !personId) return;
    let cancelled = false;

    (async () => {
      try {
        const person = await peopleService.getPersonById(companyId, personId);
        if (cancelled) return;
        if (person.preferredLanguage) {
          applyServerLocale(person.preferredLanguage);
          return;
        }
        const settings = await companySettingsService.getSettings(companyId);
        if (!cancelled) applyServerLocale(settings.defaultLanguage);
      } catch {
        // Offline or unauthorized — keep the locally resolved locale
      }
    })();

    return () => {
      cancelled = true;
    };
    // applyServerLocale is stable per provider render; person/company identify the fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, personId]);
}
