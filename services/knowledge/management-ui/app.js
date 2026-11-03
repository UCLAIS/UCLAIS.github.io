/* All source text is inserted with textContent/value; uploaded material never becomes HTML. */
const $ = id => document.getElementById(id);
let session;
let library = { commit: '', files: [] };
let documentCommit = '';
let busy = false;
const element = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
function link(text, url) { const node = element('a', text); const target = new URL(url); if (target.protocol !== 'https:') throw new Error('Invalid link.'); node.href = target.href; node.target = '_blank'; node.rel = 'noopener noreferrer'; return node; }
function message(text, error = false, url) { const node = $('message'); node.replaceChildren(document.createTextNode(text + ' ')); if (url) node.append(link('Open pull request ↗', url)); node.hidden = false; node.classList.toggle('error', error); node.scrollIntoView({ behavior: 'instant', block: 'nearest' }); }
async function api(path, body) {
  const result = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  if (result.status === 401) { location.href = '/'; throw new Error('Sign in to continue.'); }
  const value = await result.json(); if (!result.ok) throw new Error(value.message || 'The request failed.'); return value;
}
function tab(name) { document.querySelectorAll('.view').forEach(node => { node.hidden = node.id !== name; }); document.querySelectorAll('[data-tab]').forEach(node => { if (node.dataset.tab === name) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); }); }
document.querySelectorAll('[data-tab]').forEach(node => node.addEventListener('click', () => tab(node.dataset.tab)));
$('logout').addEventListener('click', async () => { try { await api('/api/logout', {}); location.href = '/'; } catch (error) { message(error.message, true); } });
function filename(path) { return path.slice('knowledge/'.length).replace(/\.md$/, '').replace(/-/g, ' '); }
function renderLibrary() {
  const query = $('filter').value.toLowerCase();
  const matches = library.files.filter(file => file.path.toLowerCase().includes(query));
  $('documents').replaceChildren(...matches.map(file => { const button = element('button', filename(file.path)); button.type = 'button'; button.dataset.path = file.path; if (file.path === $('document-path').value) button.setAttribute('aria-current', 'true'); button.addEventListener('click', () => openDocument(file.path)); return button; }));
  if (!matches.length) $('documents').append(element('p', 'No matching documents.', 'muted'));
}
function dirty() { return $('document-content').value !== ($('document-content').dataset.saved || ''); }
async function openDocument(path) {
  if (dirty() && !confirm('Discard your unsaved changes?')) return;
  try { const doc = await api('/api/document?path=' + encodeURIComponent(path)); $('document-path').value = doc.path; $('document-content').value = doc.content; $('document-content').dataset.saved = doc.content; documentCommit = doc.commit; $('knowledge-public').checked = false; renderLibrary(); }
  catch (error) { message(error.message, true); }
}
async function loadLibrary() {
  library = await api('/api/library'); renderLibrary();
  $('slide-target').replaceChildren(element('option', 'New tutorial or Nexus session'));
  $('slide-target').firstChild.value = '';
  library.files.filter(file => /^knowledge\/(tutorials|nexus)\//.test(file.path)).forEach(file => { const option = element('option', filename(file.path)); option.value = file.path; $('slide-target').append(option); });
  if (!documentCommit) documentCommit = library.commit;
}
$('filter').addEventListener('input', renderLibrary);
$('new-document').addEventListener('click', () => { if (dirty() && !confirm('Discard your unsaved changes?')) return; $('document-path').value = ''; $('document-content').value = '# Your title\n\n'; $('document-content').dataset.saved = $('document-content').value; documentCommit = library.commit; $('knowledge-public').checked = false; renderLibrary(); $('document-path').focus(); });
$('slide-target').addEventListener('change', () => { const replace = !!$('slide-target').value; $('new-slide-fields').hidden = replace; $('replacement-note').hidden = !replace; });
$('slide-file').addEventListener('change', () => { const file = $('slide-file').files[0]; $('file-detail').textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MiB` : 'Export your deck to PDF. Maximum 8 MiB.'; });
async function submit(form, action) {
  if (busy) return; busy = true;
  const buttons = [...document.querySelectorAll('button')]; buttons.forEach(button => { button.disabled = true; }); form.setAttribute('aria-busy', 'true');
  try { const pr = await action(); message(`Submitted as pull request #${pr.number}. Review and merge it to publish.`, false, pr.url); await loadProposals(); }
  catch (error) { message(error.message, true); }
  finally { busy = false; buttons.forEach(button => { button.disabled = false; }); form.removeAttribute('aria-busy'); }
}
$('knowledge-form').addEventListener('submit', event => { event.preventDefault(); submit(event.currentTarget, async () => {
  const result = await api('/api/knowledge', { path: $('document-path').value.trim(), content: $('document-content').value, commit: documentCommit });
  $('document-content').dataset.saved = $('document-content').value; $('knowledge-public').checked = false; return result;
}); });
function readPdf(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('This file could not be read.')); reader.readAsDataURL(file); }); }
$('slides-form').addEventListener('submit', event => { event.preventDefault(); submit(event.currentTarget, async () => {
  const file = $('slide-file').files[0];
  if (!file || !/\.pdf$/i.test(file.name) || file.size > 8 * 1024 * 1024) throw new Error('Choose a PDF no larger than 8 MiB.');
  const existing = $('slide-target').value;
  if (!existing && (!$('slide-title').value.trim() || !$('slide-path').value.trim())) throw new Error('Add a session title and path.');
  const path = existing || `knowledge/${$('slide-collection').value}/${$('slide-path').value.trim().replace(/\.md$/, '')}.md`;
  const result = await api('/api/slides', { path, replace: !!existing, title: $('slide-title').value, year: $('slide-year').value, series: $('slide-series').value, order: $('slide-order').value, notes: $('slide-notes').value, commit: library.commit, pdf: await readPdf(file) });
  $('slides-public').checked = false; $('slide-file').value = ''; $('file-detail').textContent = 'Export your deck to PDF. Maximum 8 MiB.'; return result;
}); });
async function loadProposals() {
  try { const data = await api('/api/proposals'); $('proposals').replaceChildren(...data.proposals.map(pr => { const row = element('div', undefined, 'row'); const content = element('div'); content.append(link(pr.title, pr.url), element('p', `#${pr.number} · @${pr.author}`)); row.append(content, element('span', 'In review', 'badge unknown')); return row; })); if (!data.proposals.length) $('proposals').append(element('p', 'No management submissions awaiting review.', 'muted')); }
  catch { $('proposals').replaceChildren(element('p', 'Submissions could not be loaded. Open GitHub to check.', 'muted')); }
}
async function loadStatus() {
  $('refresh-status').disabled = true; $('checked-at').textContent = 'Checking live services…';
  try {
    const data = await api('/api/status');
    const labels = { ready: 'Healthy', degraded: 'Needs attention', unavailable: 'Unavailable', unknown: 'Unverified' };
    $('checks').replaceChildren(...data.checks.map(check => { const row = element('article', undefined, 'check'); const title = element('h3'); title.append(link(check.name, check.url)); row.append(title, element('p', check.detail), element('span', labels[check.state] || 'Unverified', `badge ${check.state}`)); return row; }));
    $('checked-at').textContent = `Last checked ${new Date(data.checkedAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })} (London time).`;
    $('workflows').replaceChildren(...data.workflows.map(run => { const row = element('div', undefined, 'row'); const content = element('div'); content.append(link(run.name, run.url), element('p', run.commit ? `Commit ${run.commit.slice(0, 7)}` : 'No recent run available')); const state = run.status === 'completed' ? run.conclusion === 'success' ? 'ready' : 'degraded' : 'unknown'; row.append(content, element('span', run.conclusion || run.status, `badge ${state}`)); return row; }));
  } catch (error) { $('checked-at').textContent = 'Checks could not be completed.'; $('checks').replaceChildren(element('p', error.message, 'muted')); }
  finally { $('refresh-status').disabled = false; }
}
$('refresh-status').addEventListener('click', loadStatus);
window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
(async () => { try { session = await api('/api/session'); $('account').textContent = `@${session.user.login}`; await Promise.all([loadLibrary(), loadStatus(), loadProposals()]); } catch (error) { message(error.message, true); } })();
