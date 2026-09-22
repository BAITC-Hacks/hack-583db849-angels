import { redirect } from 'next/navigation';

/** The demo starts with choosing a candidate. */
export default function Home() {
  redirect('/demo/candidates');
}
