import { ArrowTrendingUpIcon, LightBulbIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { CandidateFeedback } from '../../lib/report/types';

/**
 * The candidate's feedback after the simulation. English, developmental, and
 * free of anything that grades: no score, no scale, no ranking, no hint of a
 * decision. The same component renders on the candidate's page and in the
 * commission's preview of it, so what the commission checks is what is sent.
 */
export function FeedbackView({ feedback }: { feedback: CandidateFeedback }) {
  const sections = [
    { title: 'What you did well', items: feedback.strengths, icon: SparklesIcon },
    { title: 'What to work on', items: feedback.growth, icon: ArrowTrendingUpIcon },
    { title: 'Try next time', items: feedback.nextTime, icon: LightBulbIcon },
  ];

  return (
    <div lang="en" className="flex flex-col gap-4">
      {sections.map((section) => (
        <section key={section.title} className="rounded-panel border border-border-subtle bg-bg-surface p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <section.icon aria-hidden="true" className="h-4 w-4 text-brand-ink" />
            {section.title}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {section.items.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-text-secondary">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-green" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="px-1 text-[0.8rem] text-text-muted">
        This feedback is written to help you grow. It contains no scores and says nothing about admission decisions.
      </p>
    </div>
  );
}
