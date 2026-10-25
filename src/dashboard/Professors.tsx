import { useRef } from 'react';
import { sampleCandidates, type ProfessorPreview, type SampleState } from './professor-preview';
const labels: Record<SampleState, string> = { unavailable: 'Ratings unavailable', loading: 'Loading', available: 'Match found', ambiguous: 'Choose a match', 'no-match': 'No match found', 'no-reviews': 'No reviews', stale: 'Stale cached result' };
export function Professors({ model }: { model: ProfessorPreview }) {
  const nameInput = useRef<HTMLInputElement>(null); const urlInput = useRef<HTMLInputElement>(null);
  const reviewPanel = useRef<HTMLElement>(null);
  const sampleRating = model.sample === 'available' || model.sample === 'stale';
  return <>
    <div className="page-heading"><div><h1 id="page-title">Professors</h1><p>Keep the instructor and the profile together.</p></div></div>
    <p className="professor-availability">Live UHD search and ratings are not connected yet. You can review a profile link below; saving associations is not available in this build.</p>
    <div className="professor-layout">
      <section className="profile-editor" aria-labelledby="profile-title">
        <h2 id="profile-title">Review a professor link</h2>
        <p id="profile-scope">Enter one instructor at a time. This draft stays in this tab while you navigate; reloading clears it. No school or identity is verified automatically.</p>
        <form noValidate onSubmit={event => { event.preventDefault(); const field = model.submit(); if (field) (field === 'name' ? nameInput : urlInput).current?.focus(); else queueMicrotask(() => reviewPanel.current?.focus()); }}>
          <label htmlFor="professor-name">Professor name<input id="professor-name" ref={nameInput} value={model.name} maxLength={200} autoComplete="off" aria-invalid={!!model.errors.name} aria-describedby={model.errors.name ? 'professor-name-error' : 'profile-scope'} onChange={event => model.change('name', event.target.value)} /></label>
          {model.errors.name && <p id="professor-name-error" className="error-message" role="alert">{model.errors.name}</p>}
          <label htmlFor="professor-url">RateMyProfessors profile link<input id="professor-url" ref={urlInput} type="url" inputMode="url" value={model.url} maxLength={2048} autoComplete="off" spellCheck={false} aria-invalid={!!model.errors.url} aria-describedby={model.errors.url ? 'professor-url-error' : 'professor-url-help'} onChange={event => model.change('url', event.target.value)} /></label>
          <p id="professor-url-help" className="field-help">Use the HTTPS profile address ending in /professor/ and a number. Search pages and school pages are not professor profiles.</p>
          {model.errors.url && <p id="professor-url-error" className="error-message" role="alert">{model.errors.url}</p>}
          <div className="profile-actions"><button type="submit" className="button button-primary">Review link</button><button type="button" className="button button-secondary" onClick={() => { model.clear(); nameInput.current?.focus(); }}>Clear draft</button></div>
        </form>
      </section>
      <section className="profile-review" ref={reviewPanel} tabIndex={-1} aria-labelledby="profile-review-title">
        <h2 id="profile-review-title">{model.review ? 'Unverified profile link' : 'Your link preview'}</h2>
        {model.review ? <>
          <dl><div><dt>Instructor you entered</dt><dd>{model.review.instructorName}</dd></div><div><dt>School</dt><dd>Not verified — check for University of Houston Downtown on the profile.</dd></div><div><dt>Ratings</dt><dd>Not loaded</dd></div></dl>
          <a className="button button-secondary" href={model.review.profileUrl} target="_blank" rel="noopener noreferrer">Open profile to view ratings <span className="sr-only">(opens a new tab)</span></a>
          <p className="destination-host">{model.review.profileUrl}</p>
          <p role="status">Link format checked. This is a draft, not a saved or verified association.</p>
        </> : <p>Review a link to check its address before opening it. Match the name, UHD school and department yourself. Editing either field clears the previous preview.</p>}
      </section>
    </div>
    <details className="professor-samples"><summary>Preview sample rating states</summary>
      <div className="sample-content"><h2>Sample data only</h2><p>Invented identities and ratings for reviewing this interface. No live search, profile lookup or saved association occurs here.</p>
        <label htmlFor="sample-professor-state"><span id="sample-professor-label">Sample state</span><select aria-labelledby="sample-professor-label" id="sample-professor-state" value={model.sample} onChange={event => model.selectSample(event.target.value as SampleState)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <section className="sample-result" aria-label="Sample professor result">
          <h3>{labels[model.sample]}</h3>
          <div role="status" aria-live="polite">
            {model.sample === 'loading' && <p>Sample loading state — waiting for professor information. No request is running.</p>}
            {model.sample === 'unavailable' && <p>Ratings unavailable. A live provider is not connected. Missing ratings are not zero.</p>}
            {model.sample === 'no-match' && <p>No sample match found. Check the instructor spelling and school, or review a profile link above. No association was chosen.</p>}
            {model.sample === 'ambiguous' && <p>Two sample identities share a name. Compare departments and choose explicitly; no automatic match.</p>}
            {model.sample === 'stale' && <p>Stale sample — this cached example has expired. A live refresh would be required before presenting it as current.</p>}
            {model.sample === 'available' && <p>Sample match found. This is invented data, not a verified UHD professor.</p>}
            {model.sample === 'no-reviews' && <p>No sample reviews yet. A missing overall rating is not a score of zero.</p>}
          </div>
          {model.sample === 'ambiguous' && <ul className="sample-candidates">{sampleCandidates.map(candidate => <li key={candidate.id}><div><strong>{candidate.name}</strong><span>{candidate.department} · UHD sample identity, unverified</span></div><button type="button" className="button button-secondary" aria-pressed={model.chosen === candidate.id} onClick={() => model.setChosen(candidate.id)}>Choose {candidate.department}<span className="sr-only"> sample</span></button></li>)}</ul>}
          {model.sample === 'ambiguous' && model.chosen && <p role="status">Sample choice: {sampleCandidates.find(candidate => candidate.id === model.chosen)?.department}. Nothing was saved. Choose the other candidate to correct the sample association.</p>}
          {(sampleRating || model.sample === 'no-reviews') && <><p className="sample-identity"><strong>Alex Sample</strong> · Computer Science · UHD sample identity, unverified</p><dl className="sample-rating"><div><dt>Sample overall rating</dt><dd>{sampleRating ? '4.2 / 5' : 'Not rated'}</dd></div><div><dt>Sample review count</dt><dd>{sampleRating ? '12' : '0'}</dd></div></dl><p>Source: synthetic fixture. No live profile is linked to these values.</p><p>Example checked time: October 20, 2026 at 12:00 UTC.{model.sample === 'stale' && ' Example expiry: October 21, 2026 at 12:00 UTC.'}</p></>}
        </section>
      </div>
    </details>
  </>;
}