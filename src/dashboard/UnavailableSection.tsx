import { Icon } from '../ui/Icon';

const content = {
  professors: {
    title: 'Professors', subtitle: 'Professor information for the classes you’re considering.',
    heading: 'Ratings aren’t available yet',
    description: 'Professor search and RateMyProfessors profile connections are still being built. No ratings have been loaded in this extension.',
  },
  enrollment: {
    title: 'Enrollment', subtitle: 'Plan ahead for class registration.',
    heading: 'Enrollment tools aren’t available yet',
    description: 'Immediate and scheduled enrollment are still being built. Visiting this page does not select classes or submit enrollment.',
  },
  settings: {
    title: 'Settings', subtitle: 'A timetable that fits your week.',
    heading: 'Settings aren’t available yet',
    description: 'Visible days, timetable hours, and timezone controls are still being built. Backup and import controls are not available yet.',
  },
} as const;

export function UnavailableSection({ section }: { section: keyof typeof content }) {
  const page = content[section];
  return (
    <>
      <div className="page-heading"><div><h1 id="page-title">{page.title}</h1><p>{page.subtitle}</p></div></div>
      <section className="feature-notice" aria-labelledby="unavailable-title">
        <Icon name="info" />
        <div>
          <h2 id="unavailable-title">{page.heading}</h2>
          <p>{page.description}</p>
          <a className="text-action" href="#timetable">Back to timetable<Icon name="arrow" /></a>
        </div>
      </section>
    </>
  );
}
