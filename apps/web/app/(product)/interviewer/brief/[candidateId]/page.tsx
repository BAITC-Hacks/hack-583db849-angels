import type { Metadata } from 'next';
import { BriefClarify, BriefConsistency, BriefEnglish, BriefQuestions } from '../../../../../components/brief/BriefSections';
import { SourcesPanel } from '../../../../../components/brief/SourcesPanel';
import { SurpriseAnswer } from '../../../../../components/surprise/SurpriseAnswer';
import { MarkBriefViewed } from '../../../../../components/home/MarkBriefViewed';
import { getBrief } from '../../../../../lib/brief/preview';
import { getStaffLocale } from '../../../../../lib/i18n/server';
import { previewSurpriseAnswered } from '../../../../../lib/surprise/preview';

export const metadata: Metadata = { title: 'Interviewer brief — AI Leader ID' };

const copy = {
  en: {
    preview: 'Preview · a scripted brief — the real one arrives with M1',
    eyebrow: 'Interviewer brief',
    candidate: 'Candidate',
    lede: 'Read it before the interview: what to ask, and what the candidate said about themselves against what was measured. Every item shows where it comes from, and nothing here is a score.',
    privacy: 'The model saw the answers, not the person: no name, IIN, contacts, school, region or photo.',
    summary: 'In short',
  },
  ru: {
    preview: 'Превью · заготовленный бриф — настоящий появится в M1',
    eyebrow: 'Бриф для интервьюера',
    candidate: 'Кандидат',
    lede: 'Прочитайте перед интервью: что спросить и что заявил кандидат против того, что измерено. У каждого пункта виден источник, и оценок здесь нет.',
    privacy: 'Модель видела ответы, а не человека: без имени, ИИН, контактов, школы, региона и фото.',
    summary: 'Коротко',
  },
};

/**
 * M1: everything the interviewer needs in one screen before the meeting —
 * questions for each D.R.I.V.E. letter and for the three things no rubric
 * covers (what they know about inVision U, their real English, whether the
 * application was deliberate), what they claimed against what was measured,
 * topics to clarify and the English gap. Every item is traceable to the answer
 * it came from. Scripted until the briefs API lands (#12).
 */
export default async function BriefPage({ params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  const text = copy[await getStaffLocale()];
  const brief = getBrief(candidateId);

  return (
    <>
      <MarkBriefViewed />
      <p className="border-b border-border-subtle bg-bg-elevated px-5 py-1.5 text-center font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase">
        {text.preview}
      </p>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
          <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">
            {text.candidate} {brief.candidate.code}
          </h1>
          <p className="max-w-3xl text-sm text-text-secondary">{text.lede}</p>
          <p className="max-w-3xl font-mono text-[0.68rem] text-text-muted">{text.privacy}</p>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
          <div className="flex flex-col gap-6">
            <section className="rounded-panel border-l-2 border-brand-green bg-bg-surface px-5 py-4">
              <h2 className="font-mono text-[0.6rem] tracking-[0.14em] text-text-muted uppercase">{text.summary}</h2>
              <p className="mt-1 text-sm text-text-primary">{brief.summary}</p>
            </section>
            <BriefQuestions questions={brief.questions} />
            <BriefConsistency items={brief.consistency} />
            <SurpriseAnswer surprise={previewSurpriseAnswered} />
            <div className="grid items-start gap-4 md:grid-cols-2">
              <BriefClarify items={brief.clarify} />
              <BriefEnglish english={brief.english} />
            </div>
          </div>

          <div className="lg:sticky lg:top-6">
            <SourcesPanel application={brief.application} test={brief.test} />
          </div>
        </div>
      </main>
    </>
  );
}
