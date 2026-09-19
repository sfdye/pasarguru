import type { Lang } from './market-logic.ts';

/**
 * NEA writes `remarks_other_works` as free English text and the app shows it verbatim, so
 * these are the recurring remarks worth translating for zh readers. Keyed by the
 * entity-decoded remark; anything not listed falls back to the raw string — a one-off
 * sentence in English beats a wrong guess, and NEA can add new wording at any time.
 */
const REMARKS_ZH: Record<string, string> = {
  'Repairs and Redecoration': '维修与重新粉刷',
  'Repairs and Redecoration and Hawker Centres Transformation Programme':
    '维修、重新粉刷及小贩中心转型计划',
  'Closed for redevelopment till 2029 (tentative)': '关闭重建至2029年（暂定）',
  'Urgent repair work to be carried out by Ang Mo Kio Town Council.':
    '宏茂桥镇理事会将进行紧急维修工程。',
};

export function localizeRemarks(remarks: string | undefined, lang: Lang): string {
  if (!remarks) return '';
  return lang === 'zh' ? (REMARKS_ZH[remarks] ?? remarks) : remarks;
}
