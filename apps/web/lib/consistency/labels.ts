import type { Copy } from '../i18n/staffLocale';
import type { ConsistencyStatus, ConsistencyTopic } from './types';

/**
 * The words for a status and a topic, in one place: the brief and the
 * commission's screen show the same item at two moments, and they must not
 * drift into naming it differently.
 */
export const statusWords: Copy<Record<ConsistencyStatus, string>> = {
  en: {
    discrepancy: 'Does not match',
    unverified: 'Not verified',
    consistent: 'Matches',
    confirmed: 'Confirmed in the interview',
    resolved: 'Cleared up in the interview',
  },
  ru: {
    discrepancy: 'Не сходится',
    unverified: 'Не проверено',
    consistent: 'Сходится',
    confirmed: 'Подтвердилось на интервью',
    resolved: 'Снялось на интервью',
  },
};

export const topicWords: Copy<Record<ConsistencyTopic, string>> = {
  en: {
    english: 'English',
    invision_knowledge: 'inVision U',
    motivation: 'Motivation',
    experience: 'Experience',
    achievements: 'Achievements',
    other: 'Other',
  },
  ru: {
    english: 'Английский',
    invision_knowledge: 'inVision U',
    motivation: 'Мотивация',
    experience: 'Опыт',
    achievements: 'Достижения',
    other: 'Другое',
  },
};

/** A discrepancy reads as a warning; a settled item does not. */
export function statusTone(status: ConsistencyStatus): 'open' | 'settled' {
  return status === 'discrepancy' ? 'open' : 'settled';
}
