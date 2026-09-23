import type { Metadata } from 'next';
import { QualityCheckPanel } from '../../../../components/quality/QualityPanel';
import { getStaffLocale } from '../../../../lib/i18n/server';
import { previewCalibrationCheck, previewInterviewCheck } from '../../../../lib/quality/preview';

export const metadata: Metadata = { title: 'Quality guard — AI Leader ID' };

const copy = {
  en: {
    preview: 'Preview · scripted checks — the real ones arrive with M5',
    eyebrow: 'Quality guard',
    title: 'How the interviews are run',
    lede: 'Signals about the process and about an interviewer’s own scale, each with what to do next. Nothing here is about a candidate, and nothing here changes anyone’s score.',
    privacy: 'Built from interview transcripts and from saved scores without candidate data. Quotes are the interviewer’s own questions.',
    interview: 'This interview',
    interviewNote: 'Interview of 26 September · interviewer-2',
    calibration: 'This interviewer, over the month',
    calibrationNote: 'interviewer-2 · 1–30 September',
  },
  ru: {
    preview: 'Превью · заготовленные проверки — настоящие появятся в M5',
    eyebrow: 'Контроль качества',
    title: 'Как проходят интервью',
    lede: 'Сигналы о процессе и о шкале самого интервьюера, к каждому — что сделать. Здесь нет ничего о кандидате, и ничего здесь не меняет чьи-либо баллы.',
    privacy: 'Собрано из расшифровок интервью и из сохранённых баллов без данных о кандидатах. Цитаты — собственные вопросы интервьюера.',
    interview: 'Это интервью',
    interviewNote: 'Интервью 26 сентября · interviewer-2',
    calibration: 'Этот интервьюер за месяц',
    calibrationNote: 'interviewer-2 · 1–30 сентября',
  },
};

/**
 * M5: the commission's view of how the interviews themselves are going.
 *
 * Signals and recommendations, never a verdict — and never a word about a
 * candidate. A panel reads this about its own work, which is the only way a
 * check like this is fair to the people being interviewed.
 *
 * Scripted until the quality-checks API lands (#18).
 */
export default async function QualityGuardPage() {
  const text = copy[await getStaffLocale()];

  return (
    <>
      <p className="border-b border-border-subtle bg-bg-elevated px-5 py-1.5 text-center font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase">
        {text.preview}
      </p>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-8">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
          <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">{text.title}</h1>
          <p className="max-w-3xl text-sm text-text-secondary">{text.lede}</p>
          <p className="max-w-3xl font-mono text-[0.68rem] text-text-muted">{text.privacy}</p>
        </header>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-text-primary">{text.interview}</h2>
            <p className="font-mono text-[0.68rem] text-text-muted">{text.interviewNote}</p>
          </div>
          <QualityCheckPanel check={previewInterviewCheck} />
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-text-primary">{text.calibration}</h2>
            <p className="font-mono text-[0.68rem] text-text-muted">{text.calibrationNote}</p>
          </div>
          <QualityCheckPanel check={previewCalibrationCheck} />
        </section>
      </main>
    </>
  );
}
