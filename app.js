import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { CONFIG } from './config.js';

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const app = $('#app');
const state = {
  sb: null, user: null, session: null, membership: null, memberships: [],
  institutionId: null, role: null, page: 'overview',
  subjects: [], banks: [], questions: [], exams: [], members: [],
  candidateExams: [], runner: null, runnerTimer: null, runnerSaving: false,
  savingAnswerTimer: null, profile: null, loading: false
};

const canManage = () => ['owner','admin'].includes(state.role);
const canAuthor = () => ['owner','admin','question_setter'].includes(state.role);
const canViewResults = () => ['owner','admin','examiner'].includes(state.role);
const canInvigilate = () => ['owner','admin','invigilator'].includes(state.role);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const initials = value => String(value || 'E').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join('');
const dateShort = value => value ? new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)) : '—';
const dateTime = value => value ? new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)) : 'Not scheduled';
const timeFromMinutes = value => `${Math.floor(Number(value||0)/60)}h ${Number(value||0)%60}m`;

function toast(message, type='') {
  const root = $('#toast-root'); if (!root) return;
  const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message; root.append(el);
  setTimeout(()=>el.remove(),4000);
}
function errorMessage(error) {
  const message = error?.message || String(error || 'An unexpected error occurred.');
  if (/permission denied|row-level security/i.test(message)) return 'You do not have permission to complete that action. Check your institution role.';
  if (/invalid login credentials/i.test(message)) return 'The email or password is incorrect.';
  if (/email not confirmed/i.test(message)) return 'Please confirm your email address before signing in.';
  return message;
}

async function boot() {
  state.sb = createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  state.sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      state.user=null; state.session=null; state.membership=null; state.role=null; state.institutionId=null;
      state.runner=null; clearInterval(state.runnerTimer); renderAuth('login');
    } else if (event === 'PASSWORD_RECOVERY' && session) {
      state.user=session.user;state.session=session;renderPasswordUpdate();
    }
  });
  const {data,error} = await state.sb.auth.getSession();
  if (error) { renderAuth('login',errorMessage(error)); return; }
  if (data.session) {
    state.session=data.session; state.user=data.session.user;
    await enterWorkspace();
  } else renderAuth(new URLSearchParams(location.search).get('register')==='1'?'register':'login');
}

function renderAuth(mode='login', message='') {
  clearInterval(state.runnerTimer); state.runner=null;
  const register = mode==='register'; const reset = mode==='reset';
  app.innerHTML = `
    <div class="login-wrap">
      <section class="login-hero">
        <div class="brand-lockup"><img src="/assets/ethan-digital-academy-logo.png" alt="Ethan Digital Academy"><div><b>ETHAN CBT</b><small>PREPARE · ASSESS · EXCEL</small></div></div>
        <div class="login-copy"><div class="login-kicker">EXAMINATION MANAGEMENT & DIGITAL ASSESSMENT</div><h1>Assess learning.<br><span>Measure progress.</span></h1><p>A professional computer-based testing platform for creating examinations, managing candidates and delivering dependable assessment experiences.</p></div>
        <div class="login-feature-grid"><div class="login-feature"><b>01 · CREATE</b><span>Build reusable question banks and structured examinations.</span></div><div class="login-feature"><b>02 · ASSESS</b><span>Run secure, timed computer-based tests.</span></div><div class="login-feature"><b>03 · IMPROVE</b><span>Mark, analyse and report learner performance.</span></div></div>
        <div class="login-foot">© ${new Date().getFullYear()} Ethan Digital Academy · LEARN. BUILD. GROW. LEAD.</div>
      </section>
      <section class="login-panel">
        <h2>${reset?'Reset your password':register?'Create a candidate account':'Welcome back'}</h2>
        <p>${reset?'Enter your account email and we will send a password reset link.':register?'Create your ETHAN CBT account. Your institution must assign your role before you can access examinations.':'Sign in to your Ethan Digital Academy examination workspace.'}</p>
        ${message?`<div class="form-error" style="margin-bottom:15px">${esc(message)}</div>`:''}
        <form id="auth-form" class="form-stack">
          ${register?`<div class="field"><label for="auth-name">Full name</label><input id="auth-name" name="full_name" autocomplete="name" required placeholder="Your full name"></div>`:''}
          <div class="field"><label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com"></div>
          ${reset?'':`<div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="${register?'new-password':'current-password'}" required minlength="8" placeholder="${register?'Create a password':'Enter your password'}"></div>`}
          ${!register&&!reset?`<div class="login-options"><span>Use your registered Ethan CBT account</span><button class="text-button" type="button" id="forgot-password">Forgot password?</button></div>`:''}
          <button class="primary-btn full-btn" id="auth-submit" type="submit">${reset?'Send reset link':register?'Create account':'Sign in securely'}</button>
        </form>
        <div class="login-divider">ETHAN DIGITAL ACADEMY</div>
        <div class="notice">Candidate accounts must be assigned to an examination group by an authorised Ethan CBT administrator before exams become available.</div>
        <p style="margin:20px 0 0;text-align:center;font-size:10px;color:#8895a6">${register?'Already registered?':reset?'Remember your password?':'New candidate?'} <button class="text-button" id="auth-switch" type="button">${register||reset?'Return to sign in':'Create a candidate account'}</button></p>
      </section>
    </div>`;
  $('#auth-form').addEventListener('submit',handleAuthSubmit);
  $('#auth-switch').addEventListener('click',()=>renderAuth(register||reset?'login':'register'));
  $('#forgot-password')?.addEventListener('click',()=>renderAuth('reset'));
}

async function handleAuthSubmit(event) {
  event.preventDefault(); const form = new FormData(event.currentTarget); const button=$('#auth-submit');
  const email=String(form.get('email')||'').trim().toLowerCase(); const password=String(form.get('password')||'');
  const mode = $('h2',app)?.textContent?.includes('Reset')?'reset':$('h2',app)?.textContent?.includes('Create a candidate')?'register':'login';
  button.disabled=true; button.textContent='Please wait…';
  try {
    if (mode==='register') {
      const {data,error}=await state.sb.auth.signUp({email,password,options:{data:{full_name:String(form.get('full_name')||'').trim()}}});
      if(error)throw error;
      if(data.session){state.session=data.session;state.user=data.user;await enterWorkspace();}
      else renderAuth('login','Account created. Check your email to confirm your address, then sign in. Your institution administrator must assign your role.');
    } else if(mode==='reset') {
      const {error}=await state.sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin}); if(error)throw error;
      renderAuth('login','Password reset instructions have been sent if this email is registered.');
    } else {
      const {data,error}=await state.sb.auth.signInWithPassword({email,password}); if(error)throw error;
      state.session=data.session;state.user=data.user;await enterWorkspace();
    }
  } catch(error) { toast(errorMessage(error),'error'); button.disabled=false; button.textContent=mode==='register'?'Create account':mode==='reset'?'Send reset link':'Sign in securely'; }
}

async function enterWorkspace() {
  if(!state.user) return renderAuth('login');
  const {data,error}=await state.sb.rpc('get_my_memberships');
  if(error) { toast(errorMessage(error),'error'); return renderAuth('login','We could not load your institution access. Please try again.'); }
  state.memberships=Array.isArray(data)?data:[];
  state.membership=state.memberships.find(m=>m.status==='active'&&m.institution_name===CONFIG.institutionName) || state.memberships[0] || null;
  if(!state.membership) return renderNoMembership();
  if(state.membership.status!=='active') return renderNoMembership('Your institution membership is not active. Contact the Ethan CBT administrator.');
  state.institutionId=state.membership.institution_id;state.role=state.membership.role;
  state.page=state.role==='candidate'?'my-exams':'overview';
  await renderWorkspace();
}

function renderNoMembership(message='Your account is registered, but it has not yet been added to an institution.') {
  app.innerHTML=`<div class="access-denied"><img src="/assets/ethan-digital-academy-logo.png" style="width:190px;max-height:80px;object-fit:contain" alt="Ethan Digital Academy"><h2>Institution access pending</h2><p>${esc(message)}</p><p>Signed in as <b>${esc(state.user?.email)}</b></p><button class="primary-btn" id="pending-signout">Sign out</button></div>`;
  $('#pending-signout').addEventListener('click',signOut);
}

function renderPasswordUpdate(message='') {
  app.innerHTML=`<div class="access-denied"><img src="/assets/ethan-digital-academy-logo.png" style="width:190px;max-height:80px;object-fit:contain" alt="Ethan Digital Academy"><h2>Set a new password</h2><p>Choose a new password for ${esc(state.user?.email||'your account')}.</p>${message?`<div class="form-error">${esc(message)}</div>`:''}<form id="password-update" class="form-stack" style="max-width:390px;margin:20px auto"><div class="field"><label>New password</label><input name="password" type="password" minlength="8" required placeholder="At least 8 characters"></div><div class="field"><label>Confirm new password</label><input name="confirm" type="password" minlength="8" required placeholder="Re-enter password"></div><button class="primary-btn" type="submit">Update password</button></form></div>`;
  $('#password-update').addEventListener('submit',async event=>{
    event.preventDefault();const d=new FormData(event.currentTarget);const password=String(d.get('password')||'');
    if(password!==String(d.get('confirm')||'')){renderPasswordUpdate('The passwords do not match.');return;}
    const {error}=await state.sb.auth.updateUser({password});if(error){renderPasswordUpdate(errorMessage(error));return;}
    toast('Password updated.','success');await enterWorkspace();
  });
}

async function signOut() {
  clearInterval(state.runnerTimer);state.runner=null;
  const {error}=await state.sb.auth.signOut({scope:'local'});
  if(error) { toast(errorMessage(error),'error'); return; }
  state.user=null;state.session=null;state.membership=null;state.role=null;state.institutionId=null;
  renderAuth('login');toast('You have signed out securely.','success');
}

function roleLabel(role) { return ({owner:'Platform owner',admin:'Administrator',question_setter:'Question setter',invigilator:'Invigilator',examiner:'Examiner',candidate:'Candidate'})[role]||role; }
function staffNav() {
  const items=[['overview','▦','Overview']];
  if(canAuthor())items.push(['subjects','▤','Subjects'],['questions','▧','Question bank'],['exams','▣','Examinations']);
  if(canManage())items.push(['members','♙','Candidates & staff']);
  if(canViewResults())items.push(['results','▥','Results & marking']);
  if(canInvigilate())items.push(['invigilation','◉','Live invigilation']);
  items.push(['settings','⚙','Settings']);return items;
}
function candidateNav(){return [['my-exams','▣','My examinations'],['my-results','▥','My results'],['settings','⚙','My account']];}

async function renderWorkspace() {
  const nav=state.role==='candidate'?candidateNav():staffNav();
  app.innerHTML=`<div class="app-layout">
    <aside class="sidebar" id="sidebar">
      <div class="side-brand"><img src="/assets/ethan-digital-academy-logo.png" alt="Ethan Digital Academy"><div><b>ETHAN CBT</b><small>PREPARE · ASSESS · EXCEL</small></div></div>
      <div class="side-caption">${state.role==='candidate'?'CANDIDATE PORTAL':'EXAMINATION WORKSPACE'}</div>
      <nav class="nav-list">${nav.map(([id,icon,label])=>`<button class="nav-item ${state.page===id?'active':''}" data-page="${id}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join('')}</nav>
      <div class="nav-spacer"></div>
      <div class="side-help"><b>Need assistance?</b><p>Contact Ethan Digital Academy for account or examination support.</p></div>
      <div class="side-user"><div class="avatar">${esc(initials(state.user?.user_metadata?.full_name||state.user?.email))}</div><div class="side-user-copy"><b>${esc(state.user?.user_metadata?.full_name||state.user?.email)}</b><span>${esc(roleLabel(state.role))}</span></div><button class="side-signout" id="side-signout" title="Sign out">↪</button></div>
    </aside>
    <main class="main">
      <header class="topbar"><div class="topbar-left"><button class="mobile-menu" id="mobile-menu" aria-label="Open navigation">☰</button><div><div class="crumb">Ethan Digital Academy / <b id="crumb">${esc(nav.find(x=>x[0]===state.page)?.[2]||'Overview')}</b></div><div class="topbar-title">${state.role==='candidate'?'Candidate portal':'Examination management'}</div></div></div><div class="topbar-right"><span class="role-pill">${esc(roleLabel(state.role))}</span><span class="top-user">${esc(state.user?.email)}</span><button class="top-signout" id="top-signout">Sign out ↪</button></div></header>
      <section class="content" id="page-content"><div class="notice-strip">Loading your Ethan CBT workspace…</div></section>
    </main>
  </div><div id="modal-root"></div>`;
  $$('.nav-item').forEach(btn=>btn.addEventListener('click',()=>goPage(btn.dataset.page)));
  $('#side-signout').addEventListener('click',signOut);$('#top-signout').addEventListener('click',signOut);
  $('#mobile-menu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
  await loadPage();
}

async function goPage(page) {
  if(page==='questions'||page==='subjects'||page==='exams') if(!canAuthor()) return toast('Your role does not allow access to this area.','error');
  if(page==='members'&&!canManage()) return toast('Only owners and administrators can manage members.','error');
  if(page==='results'&&!canViewResults()) return toast('You do not have access to results.','error');
  if(page==='invigilation'&&!canInvigilate()) return toast('You do not have access to invigilation.','error');
  state.page=page;$('#sidebar')?.classList.remove('open');$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  const label=$('.nav-item.active span:last-child')?.textContent||page;$('#crumb').textContent=label;
  await loadPage();
}

async function loadPage() {
  if(!$('#page-content')) return;
  $('#page-content').innerHTML='<div class="notice-strip">Loading live records…</div>';
  try {
    if(state.page==='overview') await pageOverview();
    else if(state.page==='subjects') await pageSubjects();
    else if(state.page==='questions') await pageQuestions();
    else if(state.page==='exams') await pageExams();
    else if(state.page==='members') await pageMembers();
    else if(state.page==='results') await pageResults();
    else if(state.page==='invigilation') await pageInvigilation();
    else if(state.page==='my-exams') await pageMyExams();
    else if(state.page==='my-results') await pageMyResults();
    else if(state.page==='settings') pageSettings();
    else await pageOverview();
  } catch(error) {
    $('#page-content').innerHTML=`<div class="access-denied"><h2>We couldn't load this page</h2><p>${esc(errorMessage(error))}</p><button class="primary-btn" id="retry-page">Try again</button></div>`;
    $('#retry-page').addEventListener('click',loadPage);
  }
}

async function queryCount(table, filter=true) {
  let q=state.sb.from(table).select('id',{count:'exact',head:true});if(filter)q=q.eq('institution_id',state.institutionId);
  const {count,error}=await q;if(error)throw error;return count||0;
}
function pageHead(kicker,title,desc,actions=''){return `<div class="page-head"><div><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div><div class="head-actions">${actions}</div></div>`;}
function panel(title,desc,content,action=''){return `<section class="panel"><div class="panel-head"><div><h3>${esc(title)}</h3>${desc?`<p>${esc(desc)}</p>`:''}</div>${action}</div><div class="panel-body">${content}</div></section>`;}
function tableEmpty(message,detail='Create your first record to begin.') {return `<div class="empty"><b>${esc(message)}</b><p>${esc(detail)}</p></div>`;}
function statCard(label,value,detail){return `<div class="stat"><div class="stat-label">${esc(label)}</div><div class="stat-value">${esc(value)}</div><div class="stat-foot">${esc(detail)}</div></div>`;}

async function pageOverview() {
  const [subjects,questions,exams,assignments,sessions,recent]=await Promise.all([
    queryCount('subjects'),queryCount('questions'),queryCount('exams'),
    (async()=>{if(!['owner','admin','examiner','invigilator'].includes(state.role))return null;const {count,error}=await state.sb.from('candidate_assignments').select('id',{count:'exact',head:true});if(error)throw error;return count||0;})(),
    (async()=>{if(!['owner','admin','examiner','invigilator'].includes(state.role))return null;const {count,error}=await state.sb.from('exam_sessions').select('id',{count:'exact',head:true}).eq('status','in_progress');if(error)throw error;return count||0;})(),
    state.sb.from('exams').select('id,title,exam_code,status,duration_minutes,created_at,opens_at,closes_at').eq('institution_id',state.institutionId).order('created_at',{ascending:false}).limit(6)
  ]);
  if(recent.error)throw recent.error;
  $('#page-content').innerHTML=`${pageHead('ACADEMIC OPERATIONS',`Welcome, ${state.user?.user_metadata?.full_name?.split(' ')[0]||'Administrator'}.`,'Your live examination workspace at Ethan Digital Academy.',canAuthor()?'<button class="btn btn-primary" id="quick-create-exam">＋ Create examination</button>':'')}
    <div class="stats">${statCard('Subjects',subjects,'Live subject records')}${statCard('Questions',questions,'Questions in your bank')}${statCard('Examinations',exams,'Draft, published and closed')}${statCard('Candidate assignments',assignments===null?'—':assignments,assignments===null?'Restricted to exam operations':'Exam registrations')}${statCard('Active sessions',sessions===null?'—':sessions,sessions===null?'Restricted to exam operations':'Candidates currently testing')}${statCard('Institution role',roleLabel(state.role),'Your current access level')}</div>
    <div class="grid-two"><section class="panel"><div class="panel-head"><div><h3>Recent examinations</h3><p>Latest examinations in your institution</p></div>${canAuthor()?'<button class="btn btn-soft" id="view-exams">View all</button>':''}</div><div class="table-wrap"><table><thead><tr><th>Examination</th><th>Code</th><th>Duration</th><th>Status</th></tr></thead><tbody>${(recent.data||[]).map(e=>`<tr><td><strong>${esc(e.title)}</strong><div class="small muted">${dateTime(e.opens_at)}</div></td><td>${esc(e.exam_code||'—')}</td><td>${e.duration_minutes} min</td><td><span class="status ${esc(e.status)}">${esc(e.status)}</span></td></tr>`).join('')||`<tr><td colspan="4">${tableEmpty('No examinations yet','Create your first exam once you have subjects and published questions.')}</td></tr>`}</tbody></table></div></section>
    <div class="cards-list"><section class="panel"><div class="panel-head"><div><h3>Quick actions</h3><p>Common tasks</p></div></div><div class="panel-body" style="display:grid;gap:9px">${canAuthor()?'<button class="btn btn-soft" data-goto="questions">＋ Create a question</button><button class="btn btn-soft" data-goto="subjects">＋ Add a subject</button><button class="btn btn-soft" data-goto="exams">＋ Create an exam</button>':''}${canManage()?'<button class="btn btn-soft" data-goto="members">＋ Add candidate or staff</button>':''}<div class="notice-strip">Candidate answers, session deadlines and automatic scoring are processed by the dedicated CBT database.</div></div></section></div></div>`;
  $('#quick-create-exam')?.addEventListener('click',()=>goPage('exams').then(openCreateExam));$('#view-exams')?.addEventListener('click',()=>goPage('exams'));
  $$('[data-goto]').forEach(b=>b.addEventListener('click',()=>goPage(b.dataset.goto)));
}

async function fetchSubjects() {
  const {data,error}=await state.sb.from('subjects').select('*').eq('institution_id',state.institutionId).order('name');if(error)throw error;state.subjects=data||[];return state.subjects;
}
async function pageSubjects() {
  const subjects=await fetchSubjects();
  $('#page-content').innerHTML=`${pageHead('CONTENT SETUP','Subjects','Organise examinations and question banks by subject.',canAuthor()?'<button class="btn btn-primary" id="add-subject">＋ Add subject</button>':'')}
  <section class="panel"><div class="panel-head"><div><h3>Institution subjects</h3><p>${subjects.length} subject records</p></div></div><div class="table-wrap"><table><thead><tr><th>Subject</th><th>Code</th><th>Description</th><th>Created</th></tr></thead><tbody>${subjects.map(s=>`<tr><td><strong>${esc(s.name)}</strong></td><td>${esc(s.code||'—')}</td><td>${esc(s.description||'—')}</td><td>${dateShort(s.created_at)}</td></tr>`).join('')||`<tr><td colspan="4">${tableEmpty('No subjects have been added','Add subjects such as Mathematics, English Language or Computer Studies.')}</td></tr>`}</tbody></table></div></section>`;
  $('#add-subject')?.addEventListener('click',openSubjectModal);
}
function openSubjectModal() {
  modal('Add a subject',`<form id="subject-form" class="form-grid"><div class="field full"><label>Subject name</label><input name="name" required placeholder="e.g. Mathematics"></div><div class="field"><label>Subject code</label><input name="code" placeholder="e.g. MTH"></div><div class="field"><label>Description</label><input name="description" placeholder="Optional subject description"></div></form>`,async()=>{
    const f=$('#subject-form');if(!f.reportValidity())return false;const d=new FormData(f);
    const {error}=await state.sb.from('subjects').insert({institution_id:state.institutionId,name:String(d.get('name')).trim(),code:String(d.get('code')||'').trim()||null,description:String(d.get('description')||'').trim()||null,created_by:state.user.id});
    if(error)throw error;closeModal();toast('Subject added.','success');await loadPage();
  });
}

async function fetchBanks() {
  const {data,error}=await state.sb.from('question_banks').select('*').eq('institution_id',state.institutionId).order('created_at',{ascending:false});if(error)throw error;state.banks=data||[];return state.banks;
}
async function fetchQuestions() {
  const {data,error}=await state.sb.from('questions').select('*').eq('institution_id',state.institutionId).order('created_at',{ascending:false}).limit(500);if(error)throw error;state.questions=data||[];return state.questions;
}
async function pageQuestions() {
  const [questions,banks]=await Promise.all([fetchQuestions(),fetchBanks()]);if(!state.subjects.length)await fetchSubjects();
  const bankCards=banks.map(b=>`<div class="list-card"><div><h4>${esc(b.name)}</h4><p>${esc(state.subjects.find(s=>s.id===b.subject_id)?.name||'All subjects')} · ${esc(b.description||'No description')}</p></div><span class="status active">BANK</span></div>`).join('');
  $('#page-content').innerHTML=`${pageHead('ASSESSMENT CONTENT','Question bank','Create, organise and publish reusable questions.',`<button class="btn" id="add-bank">＋ Question bank</button><button class="btn btn-primary" id="add-question">＋ Add question</button>`)}
    <div class="grid-two"><section class="panel"><div class="panel-head"><div><h3>Questions</h3><p>${questions.length} question records · answer keys are protected from candidates</p></div><input class="search-input" id="question-search" placeholder="Search questions…"></div><div class="table-wrap"><table><thead><tr><th>Question</th><th>Subject</th><th>Type</th><th>Difficulty</th><th>Status</th></tr></thead><tbody id="question-rows">${questionRows(questions)}</tbody></table></div></section>
    <section class="panel"><div class="panel-head"><div><h3>Question banks</h3><p>${banks.length} reusable collections</p></div></div><div class="panel-body"><div class="cards-list">${bankCards||tableEmpty('No question banks yet','Create a bank to organise questions by topic, term or examination.')}</div></div></section></div>`;
  $('#add-question').addEventListener('click',openQuestionModal);$('#add-bank').addEventListener('click',openBankModal);
  $('#question-search').addEventListener('input',e=>$('#question-rows').innerHTML=questionRows(questions.filter(q=>(q.prompt+' '+(q.topic||'')).toLowerCase().includes(e.target.value.toLowerCase()))));
}
function questionRows(list) {
  return list.map(q=>`<tr><td><strong>${esc(q.prompt.length>92?q.prompt.slice(0,92)+'…':q.prompt)}</strong><div class="small muted">${esc(q.topic||'No topic')}</div></td><td>${esc(state.subjects.find(s=>s.id===q.subject_id)?.name||'—')}</td><td>${esc(q.question_type.replaceAll('_',' '))}</td><td>${esc(q.difficulty)}</td><td><span class="status ${esc(q.status)}">${esc(q.status)}</span></td></tr>`).join('')||`<tr><td colspan="5">${tableEmpty('No matching questions','Add your first question to start a reusable question bank.')}</td></tr>`;
}
function openBankModal() {
  modal('Create a question bank',`<form id="bank-form" class="form-grid"><div class="field full"><label>Bank name</label><input name="name" required placeholder="e.g. SS2 Algebra — Term 1"></div><div class="field"><label>Subject</label><select name="subject_id"><option value="">All subjects</option>${state.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>Description</label><input name="description" placeholder="Optional"></div></form>`,async()=>{
    const f=$('#bank-form');if(!f.reportValidity())return false;const d=new FormData(f);const {error}=await state.sb.from('question_banks').insert({institution_id:state.institutionId,name:String(d.get('name')).trim(),subject_id:String(d.get('subject_id')||'')||null,description:String(d.get('description')||'').trim()||null,created_by:state.user.id});if(error)throw error;closeModal();toast('Question bank created.','success');await loadPage();
  });
}
function questionTypeFields(type) {
  const choice=['single_choice','multiple_choice','true_false'].includes(type);
  if(type==='true_false')return `<div class="field full"><label>Correct answer</label><select name="correct_tf"><option value="True">True</option><option value="False">False</option></select><input type="hidden" name="tf_type" value="1"></div>`;
  if(choice)return `<div class="field full"><label>Answer options</label><div class="notice-strip">Enter each option and select the correct answer${type==='multiple_choice'?'s':''}.</div>${['A','B','C','D'].map(letter=>`<div class="option-editor"><b>${letter}</b><input name="option_${letter}" placeholder="Option ${letter}" ${letter==='A'||letter==='B'?'required':''}><label class="inline-check"><input type="checkbox" name="correct_${letter}"> Correct</label></div>`).join('')}</div>`;
  if(type==='short_answer'||type==='fill_blank')return `<div class="field full"><label>Accepted answers</label><textarea name="accepted_answers" placeholder="Enter accepted answers, one per line"></textarea><small>Leave blank to send answers for manual marking.</small></div>`;
  return `<div class="field full"><label>Marking guide (optional)</label><textarea name="marking_notes" placeholder="Key points or rubric for the examiner"></textarea></div>`;
}
function openQuestionModal() {
  modal('Add a question',`<form id="question-form" class="form-grid">
    <div class="field full"><label>Question prompt</label><textarea name="prompt" required placeholder="Enter the complete question"></textarea></div>
    <div class="field"><label>Question type</label><select name="question_type" id="question-type"><option value="single_choice">Single choice</option><option value="multiple_choice">Multiple select</option><option value="true_false">True / False</option><option value="short_answer">Short answer</option><option value="fill_blank">Fill in the blank</option><option value="essay">Essay / written response</option></select></div>
    <div class="field"><label>Subject</label><select name="subject_id"><option value="">Select subject</option>${state.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Question bank</label><select name="bank_id"><option value="">No bank</option>${state.banks.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Difficulty</label><select name="difficulty"><option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option></select></div>
    <div class="field"><label>Topic</label><input name="topic" placeholder="e.g. Simultaneous equations"></div>
    <div class="field"><label>Publishing status</label><select name="status"><option value="published">Published</option><option value="draft">Draft</option></select></div>
    <div id="question-type-fields" class="field full">${questionTypeFields('single_choice')}</div>
  </form>`,async()=>{
    const f=$('#question-form');if(!f.reportValidity())return false;const d=new FormData(f);const type=String(d.get('question_type'));const prompt=String(d.get('prompt')).trim();
    let options=[];let correctLabels=[];let accepted=[];
    if(type==='true_false') {
      options=[{label:'A',content:'True'},{label:'B',content:'False'}];
      correctLabels=[String(d.get('correct_tf'))==='True'?'A':'B'];
    } else if(type==='single_choice'||type==='multiple_choice') {
      options=['A','B','C','D'].map(letter=>({label:letter,content:String(d.get(`option_${letter}`)||'').trim()})).filter(o=>o.content);
      correctLabels=['A','B','C','D'].filter(letter=>d.get(`correct_${letter}`)==='on');
    } else if(type==='short_answer'||type==='fill_blank') {
      accepted=String(d.get('accepted_answers')||'').split(/\n|\|/).map(x=>x.trim()).filter(Boolean);
    }
    const {data:created,error}=await state.sb.rpc('create_question_with_key',{
      p_institution_id:state.institutionId,
      p_subject_id:String(d.get('subject_id')||'')||null,
      p_bank_id:String(d.get('bank_id')||'')||null,
      p_question_type:type,p_prompt:prompt,p_difficulty:String(d.get('difficulty')),
      p_topic:String(d.get('topic')||'').trim()||null,p_status:String(d.get('status')),
      p_options:options,p_correct_option_labels:correctLabels,p_accepted_answers:accepted,
      p_marking_notes:String(d.get('marking_notes')||'').trim()||null,p_media_url:null,p_explanation:null
    });
    if(error)throw error;
    closeModal();toast('Question and marking key saved together.','success');await loadPage();
  });
  $('#question-type').addEventListener('change',e=>$('#question-type-fields').innerHTML=questionTypeFields(e.target.value));
}

async function pageExams() {
  const [subjects,questions]=await Promise.all([fetchSubjects(),fetchQuestions()]);
  const {data,error}=await state.sb.from('exams').select('*').eq('institution_id',state.institutionId).order('created_at',{ascending:false});if(error)throw error;state.exams=data||[];
  const rows=state.exams.map(e=>`<tr><td><strong>${esc(e.title)}</strong><div class="small muted">${esc(e.instructions||'No instructions')}</div></td><td>${esc(e.exam_code||'—')}</td><td>${esc(state.subjects.find(s=>s.id===e.subject_id)?.name||'—')}</td><td>${e.duration_minutes} min</td><td><span class="status ${esc(e.status)}">${esc(e.status)}</span></td><td><div class="toolbar">${canManage()?`<button class="btn btn-soft" data-assign="${e.id}">Assign</button>`:''}${e.status==='draft'?`<button class="btn btn-primary" data-publish="${e.id}">Publish</button>`:''}${canManage()&&e.status!=='draft'?`<button class="btn btn-gold" data-release="${e.id}">Release results</button>`:''}</div></td></tr>`).join('');
  $('#page-content').innerHTML=`${pageHead('EXAMINATION MANAGEMENT','Examinations','Build assessments, add questions, assign candidates and publish exam windows.',canAuthor()?'<button class="btn btn-primary" id="create-exam">＋ Create examination</button>':'')}
  <section class="panel"><div class="panel-head"><div><h3>Examination register</h3><p>${state.exams.length} examinations</p></div></div><div class="table-wrap"><table><thead><tr><th>Examination</th><th>Code</th><th>Subject</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows||`<tr><td colspan="6">${tableEmpty('No examinations created','Create an exam, add published questions and then publish it for candidates.')}</td></tr>`}</tbody></table></div></section>`;
  $('#create-exam')?.addEventListener('click',openCreateExam);
  $$('[data-assign]').forEach(b=>b.addEventListener('click',()=>openAssignModal(b.dataset.assign)));
  $$('[data-publish]').forEach(b=>b.addEventListener('click',()=>publishExam(b.dataset.publish)));
  $$('[data-release]').forEach(b=>b.addEventListener('click',()=>releaseExamResults(b.dataset.release)));
}
function openCreateExam() {
  const questionOptions=state.questions.filter(q=>q.status==='published');
  modal('Create an examination',`<form id="exam-form" class="form-grid">
    <div class="field full"><label>Examination title</label><input name="title" required placeholder="e.g. SS2 Mathematics — First Term Assessment"></div>
    <div class="field"><label>Exam code</label><input name="exam_code" placeholder="e.g. MTH-SS2-001"></div>
    <div class="field"><label>Subject</label><select name="subject_id"><option value="">Choose subject</option>${state.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Duration (minutes)</label><input name="duration_minutes" type="number" min="1" max="600" value="60" required></div>
    <div class="field"><label>Pass mark (%)</label><input name="pass_mark_percent" type="number" min="0" max="100" value="50"></div>
    <div class="field"><label>Maximum attempts</label><input name="max_attempts" type="number" min="1" max="20" value="1"></div>
    <div class="field"><label>Opens at</label><input name="opens_at" type="datetime-local"></div>
    <div class="field"><label>Closes at</label><input name="closes_at" type="datetime-local"></div>
    <div class="field full"><label>Candidate instructions</label><textarea name="instructions" placeholder="Read all questions carefully. You may review answers before submitting…"></textarea></div>
    <div class="field full"><label>Questions to include</label><div class="question-editor-list">${questionOptions.map(q=>`<label class="question-pick"><input type="checkbox" name="question_ids" value="${q.id}"><span><b>${esc(q.prompt.slice(0,115))}${q.prompt.length>115?'…':''}</b><small>${esc(state.subjects.find(s=>s.id===q.subject_id)?.name||'No subject')} · ${esc(q.question_type.replaceAll('_',' '))} · ${esc(q.difficulty)}</small></span><span><input type="number" name="points_${q.id}" value="1" min="0.25" step="0.25" aria-label="Points" style="width:54px;padding:6px;border:1px solid #dce4ed;border-radius:6px"></span></label>`).join('')||'<div class="empty">No published questions are available. Publish questions in the question bank first.</div>'}</div></div>
    <div class="field full"><label class="inline-check"><input type="checkbox" name="shuffle_questions" checked> Shuffle question order</label><label class="inline-check"><input type="checkbox" name="shuffle_options" checked> Shuffle answer options</label><label class="inline-check"><input type="checkbox" name="allow_backtrack" checked> Allow candidates to move back between questions</label><label class="inline-check"><input type="checkbox" name="publish_results"> Publish objective results immediately after submission</label></div>
    <div class="field full"><div class="notice-strip">The examination is saved as a draft first. You can publish it after the questions and schedule have been checked.</div></div>
  </form>`,async()=>{
    const f=$('#exam-form');if(!f.reportValidity())return false;const d=new FormData(f);const title=String(d.get('title')).trim();
    const questionIds=d.getAll('question_ids');
    const opens=String(d.get('opens_at')||'');const closes=String(d.get('closes_at')||'');
    const exam={institution_id:state.institutionId,subject_id:String(d.get('subject_id')||'')||null,title,
      exam_code:String(d.get('exam_code')||'').trim()||null,instructions:String(d.get('instructions')||'').trim()||null,
      duration_minutes:Number(d.get('duration_minutes')),pass_mark_percent:Number(d.get('pass_mark_percent')||50),
      max_attempts:Number(d.get('max_attempts')||1),opens_at:opens?new Date(opens).toISOString():null,closes_at:closes?new Date(closes).toISOString():null,
      shuffle_questions:d.get('shuffle_questions')==='on',shuffle_options:d.get('shuffle_options')==='on',allow_backtrack:d.get('allow_backtrack')==='on',
      publish_results:d.get('publish_results')==='on',status:'draft',created_by:state.user.id};
    const {data:created,error}=await state.sb.from('exams').insert(exam).select('id').single();if(error)throw error;
    if(questionIds.length){const links=questionIds.map((id,index)=>({exam_id:created.id,question_id:id,question_order:index+1,points:Number(d.get(`points_${id}`)||1)}));const {error:linkError}=await state.sb.from('exam_questions').insert(links);if(linkError)throw linkError;}
    closeModal();toast('Examination saved as draft. Review and publish when ready.','success');await loadPage();
  });
}
async function publishExam(id) {
  if(!confirm('Publish this examination? Candidates with assignments will be able to start it within its scheduled access window.'))return;
  const {error}=await state.sb.from('exams').update({status:'published'}).eq('id',id).eq('institution_id',state.institutionId);if(error){toast(errorMessage(error),'error');return;}toast('Examination published.','success');await loadPage();
}
async function releaseExamResults(id) {
  if(!confirm('Release all fully graded results for this examination to the affected candidates?'))return;
  const {data,error}=await state.sb.rpc('release_exam_results',{p_exam_id:id});if(error){toast(errorMessage(error),'error');return;}
  toast(`${data?.released_count||0} result(s) released to candidates.`,'success');await loadPage();
}
async function openAssignModal(examId) {
  let members=state.members;
  if(!members.length){const {data,error}=await state.sb.rpc('get_institution_members',{p_institution_id:state.institutionId});if(error){toast(errorMessage(error),'error');return;}members=data||[];state.members=members;}
  const candidates=members.filter(m=>m.role==='candidate'&&m.status==='active');
  if(!candidates.length){toast('No active candidate accounts are assigned yet. Add a registered candidate account in Candidates & staff first.','error');return;}
  modal('Assign candidates to examination',`<form id="assign-form"><div class="notice-strip">Select the candidates who should receive this examination.</div><div class="question-editor-list" style="margin-top:12px">${candidates.map(c=>`<label class="question-pick"><input type="checkbox" name="candidate_ids" value="${c.user_id}"><span><b>${esc(c.full_name||c.email||c.user_id)}</b><small>${esc(c.email||'')}</small></span></label>`).join('')}</div></form>`,async()=>{
    const ids=new FormData($('#assign-form')).getAll('candidate_ids');if(!ids.length)throw new Error('Select at least one candidate.');
    const rows=ids.map(candidate_user_id=>({exam_id:examId,candidate_user_id,assigned_by:state.user.id}));
    const {error}=await state.sb.from('candidate_assignments').upsert(rows,{onConflict:'exam_id,candidate_user_id',ignoreDuplicates:true});if(error)throw error;
    closeModal();toast(`${ids.length} candidate(s) assigned.`, 'success');await loadPage();
  });
}

async function pageMembers() {
  const {data,error}=await state.sb.rpc('get_institution_members',{p_institution_id:state.institutionId});if(error)throw error;state.members=data||[];
  $('#page-content').innerHTML=`${pageHead('ACCESS MANAGEMENT','Candidates & staff','Assign roles to registered Ethan CBT accounts. Candidate accounts must register before they can be added.',canManage()?'<button class="btn btn-primary" id="add-member">＋ Assign account</button>':'')}
  <div class="notice-strip" style="margin-bottom:14px">To add a new person, ask them to create an Ethan CBT account first using the registration link on the sign-in page. Then assign their existing email to a role here.</div>
  <section class="panel"><div class="panel-head"><div><h3>Institution members</h3><p>${state.members.length} assigned account(s)</p></div><input id="member-search" class="search-input" placeholder="Search by name or email"></div><div class="table-wrap"><table><thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead><tbody id="member-rows">${memberRows(state.members)}</tbody></table></div></section>`;
  $('#add-member')?.addEventListener('click',openMemberModal);
  $('#member-search').addEventListener('input',e=>$('#member-rows').innerHTML=memberRows(state.members.filter(m=>(m.email+' '+m.full_name).toLowerCase().includes(e.target.value.toLowerCase()))));
}
function memberRows(list){return list.map(m=>`<tr><td><strong>${esc(m.full_name||m.email||m.user_id)}</strong><div class="small muted">${esc(m.email||'')}</div></td><td>${esc(roleLabel(m.role))}</td><td><span class="status ${esc(m.status)}">${esc(m.status)}</span></td><td>${dateShort(m.joined_at)}</td></tr>`).join('')||`<tr><td colspan="4">${tableEmpty('No members assigned','Assign your first administrator, candidate, examiner or invigilator.')}</td></tr>`;}
function openMemberModal() {
  modal('Assign a registered account',`<form id="member-form" class="form-grid"><div class="field full"><label>Account email</label><input type="email" name="email" required placeholder="person@example.com"><small>The account must already exist in this ETHAN CBT Supabase project.</small></div><div class="field"><label>Full name (optional)</label><input name="full_name" placeholder="Person's full name"></div><div class="field"><label>Role</label><select name="role"><option value="candidate">Candidate</option><option value="question_setter">Question setter</option><option value="examiner">Examiner</option><option value="invigilator">Invigilator</option>${state.role==='owner'?'<option value="admin">Administrator</option>':''}</select></div><div class="field full"><label>Membership status</label><select name="status"><option value="active">Active</option><option value="suspended">Suspended</option></select></div></form>`,async()=>{
    const f=$('#member-form');if(!f.reportValidity())return false;const d=new FormData(f);
    const {data,error}=await state.sb.rpc('manage_institution_member',{p_institution_id:state.institutionId,p_email:String(d.get('email')).trim(),p_role:String(d.get('role')),p_full_name:String(d.get('full_name')||'').trim()||null,p_status:String(d.get('status'))});if(error)throw error;
    closeModal();state.members=[];toast(`${data?.email||'Account'} assigned as ${data?.role||'member'}.`,'success');await loadPage();
  });
}

async function pageResults() {
  const {data,error}=await state.sb.from('exam_results').select('*').order('created_at',{ascending:false}).limit(200);if(error)throw error;
  const rows=data||[];const examIds=[...new Set(rows.map(r=>r.exam_id))];const userIds=[...new Set(rows.map(r=>r.candidate_user_id))];
  const [exams,profiles]=await Promise.all([
    examIds.length?state.sb.from('exams').select('id,title').in('id',examIds):Promise.resolve({data:[],error:null}),
    userIds.length?state.sb.from('profiles').select('user_id,full_name,email').in('user_id',userIds):Promise.resolve({data:[],error:null})
  ]);if(exams.error)throw exams.error;if(profiles.error)throw profiles.error;
  const em=new Map((exams.data||[]).map(e=>[e.id,e.title]));const pm=new Map((profiles.data||[]).map(p=>[p.user_id,p.full_name||p.email||p.user_id]));
  const html=rows.map(r=>`<tr><td><strong>${esc(pm.get(r.candidate_user_id)||'Candidate')}</strong></td><td>${esc(em.get(r.exam_id)||'Examination')}</td><td>${Number(r.total_score).toFixed(2)} / ${Number(r.max_score).toFixed(2)}</td><td>${Number(r.percentage||0).toFixed(1)}%</td><td><span class="status ${esc(r.decision)}">${esc(r.decision)}</span></td><td><span class="status ${r.is_published?'active':'pending'}">${r.is_published?'published':'withheld'}</span></td><td>${dateShort(r.graded_at||r.created_at)}</td></tr>`).join('');
  const {data:pending,error:pendingError}=await state.sb.from('exam_sessions').select('id,exam_id,candidate_user_id,submitted_at,status').eq('status','grading').order('submitted_at',{ascending:true});if(pendingError)throw pendingError;
  $('#page-content').innerHTML=`${pageHead('ASSESSMENT OUTCOMES','Results & marking','Review scores, complete written-response marking and release results when approved.')}
  <section class="panel" style="margin-bottom:15px"><div class="panel-head"><div><h3>Pending manual marking</h3><p>${(pending||[]).length} submitted session(s) require examiner attention</p></div></div><div class="panel-body"><div class="cards-list">${(pending||[]).map(s=>`<div class="list-card"><div><h4>Session ${esc(s.id.slice(0,8))}</h4><p>${dateTime(s.submitted_at)} · Manual marking in progress</p></div><button class="btn btn-primary" data-mark="${s.id}">Open marking</button></div>`).join('')||'<div class="empty">No answers are awaiting manual marking.</div>'}</div></div></section>
  <section class="panel"><div class="panel-head"><div><h3>Examination results</h3><p>${rows.filter(r=>r.is_published).length} published · ${rows.filter(r=>!r.is_published).length} withheld or awaiting release</p></div><button class="btn" id="export-results">Export CSV</button></div><div class="table-wrap"><table><thead><tr><th>Candidate</th><th>Examination</th><th>Score</th><th>Percentage</th><th>Decision</th><th>Release</th><th>Graded</th></tr></thead><tbody>${html||`<tr><td colspan="7">${tableEmpty('No examination results yet','Results appear here after submission, grading and publication.')}</td></tr>`}</tbody></table></div></section>`;
  $$('[data-mark]').forEach(b=>b.addEventListener('click',()=>openMarking(b.dataset.mark)));
  $('#export-results').addEventListener('click',()=>downloadCSV('ethan-cbt-results.csv',['Candidate','Examination','Score','Max Score','Percentage','Decision','Graded'],rows.map(r=>[pm.get(r.candidate_user_id)||'',em.get(r.exam_id)||'',r.total_score,r.max_score,r.percentage,r.decision,r.graded_at||r.created_at])));
}
async function openMarking(sessionId) {
  const [sessionRes,questionRes,answerRes]=await Promise.all([
    state.sb.from('exam_sessions').select('id,exam_id,candidate_user_id,submitted_at').eq('id',sessionId).single(),
    state.sb.from('exam_session_questions').select('question_id,points_snapshot,manual_required,questions(prompt,question_type)').eq('session_id',sessionId).eq('manual_required',true).order('position'),
    state.sb.from('candidate_answers').select('*').eq('session_id',sessionId)
  ]);
  if(sessionRes.error)throw sessionRes.error;if(questionRes.error)throw questionRes.error;if(answerRes.error)throw answerRes.error;
  const session=sessionRes.data;const answers=new Map((answerRes.data||[]).map(a=>[a.question_id,a]));
  const questions=questionRes.data||[];
  modal(`Manual marking · ${sessionId.slice(0,8)}`,`<div class="notice-strip" style="margin-bottom:12px">Award a mark between zero and the maximum points. The final result remains unpublished until all manual responses are marked and the examination's results setting permits publication.</div>
  <form id="mark-form" class="form-stack">${questions.map((q,i)=>{const a=answers.get(q.question_id)||{};return `<div class="panel" style="padding:13px"><b style="font-size:11px;color:var(--navy)">Question ${i+1} · ${q.points_snapshot} marks</b><p style="font-size:11px;line-height:1.65;color:#43546b">${esc(q.questions?.prompt||'Question prompt unavailable')}</p><div class="notice-strip" style="margin:8px 0">Candidate response: ${esc(a.answer_text||'No written response supplied.')}</div><div class="field-row"><div class="field"><label>Score awarded</label><input name="score_${q.question_id}" type="number" min="0" max="${q.points_snapshot}" step="0.25" value="${a.manual_score??0}" required></div><div class="field"><label>Feedback (optional)</label><input name="feedback_${q.question_id}" value="${esc(a.marker_feedback||'')}" placeholder="Examiner feedback"></div></div></div>`;}).join('')||'<div class="empty">No written responses in this session.</div>'}</form>`,async()=>{
    const f=$('#mark-form');for(const q of questions){const score=Number(new FormData(f).get(`score_${q.question_id}`));const feedback=String(new FormData(f).get(`feedback_${q.question_id}`)||'');const {error}=await state.sb.rpc('mark_candidate_answer',{p_session_id:sessionId,p_question_id:q.question_id,p_awarded_score:score,p_feedback:feedback||null});if(error)throw error;}
    closeModal();toast('Manual marks saved.','success');await loadPage();
  },'Save marks');
}

async function pageInvigilation() {
  const {data:sessions,error}=await state.sb.from('exam_sessions').select('id,exam_id,candidate_user_id,started_at,deadline_at,status,attempt_number').eq('status','in_progress').order('started_at',{ascending:true});if(error)throw error;
  const examIds=[...new Set((sessions||[]).map(s=>s.exam_id))];const userIds=[...new Set((sessions||[]).map(s=>s.candidate_user_id))];
  const [exams,profiles,events]=await Promise.all([
    examIds.length?state.sb.from('exams').select('id,title').in('id',examIds):Promise.resolve({data:[],error:null}),
    userIds.length?state.sb.from('profiles').select('user_id,full_name,email').in('user_id',userIds):Promise.resolve({data:[],error:null}),
    state.sb.from('exam_events').select('session_id,event_type,occurred_at').order('occurred_at',{ascending:false}).limit(40)
  ]);if(exams.error)throw exams.error;if(profiles.error)throw profiles.error;if(events.error)throw events.error;
  const em=new Map((exams.data||[]).map(x=>[x.id,x.title]));const pm=new Map((profiles.data||[]).map(x=>[x.user_id,x.full_name||x.email||x.user_id]));
  $('#page-content').innerHTML=`${pageHead('EXAMINATION SUPERVISION','Live invigilation','View active examination sessions and recorded integrity events.')}
  <div class="notice-strip" style="margin-bottom:14px">Browser activity events are indicators for human review. They do not prove misconduct and should not be used as the sole basis for a disciplinary decision.</div>
  <section class="panel" style="margin-bottom:15px"><div class="panel-head"><div><h3>Active examination sessions</h3><p>${(sessions||[]).length} candidate session(s) currently in progress</p></div></div><div class="table-wrap"><table><thead><tr><th>Candidate</th><th>Examination</th><th>Started</th><th>Deadline</th><th>Session</th></tr></thead><tbody>${(sessions||[]).map(s=>`<tr><td><strong>${esc(pm.get(s.candidate_user_id)||'Candidate')}</strong></td><td>${esc(em.get(s.exam_id)||'Examination')}</td><td>${dateTime(s.started_at)}</td><td>${dateTime(s.deadline_at)}</td><td><span class="status active">IN PROGRESS</span></td></tr>`).join('')||`<tr><td colspan="5">${tableEmpty('No active sessions','Candidates will appear here when they start a published examination.')}</td></tr>`}</tbody></table></div></section>
  <section class="panel"><div class="panel-head"><div><h3>Recent examination events</h3><p>Visibility, network and integrity events recorded by active sessions</p></div></div><div class="table-wrap"><table><thead><tr><th>Event</th><th>Session</th><th>Recorded</th></tr></thead><tbody>${(events.data||[]).map(e=>`<tr><td>${esc(e.event_type.replaceAll('_',' '))}</td><td>${esc(e.session_id.slice(0,8))}</td><td>${dateTime(e.occurred_at)}</td></tr>`).join('')||`<tr><td colspan="3">${tableEmpty('No events recorded yet')}</td></tr>`}</tbody></table></div></section>`;
}

async function pageMyExams() {
  const {data,error}=await state.sb.rpc('get_my_assigned_exams');if(error)throw error;state.candidateExams=Array.isArray(data)?data:[];
  $('#page-content').innerHTML=`${pageHead('CANDIDATE PORTAL','My examinations','Examinations assigned to your Ethan Digital Academy account.')}
  <div class="notice-strip" style="margin-bottom:14px">Your examination timer is controlled by the server. Your responses are saved as you work. If your connection drops, sign back in and resume before your deadline.</div>
  <div class="cards-list">${state.candidateExams.map(e=>`<div class="list-card"><div><h4>${esc(e.title)}</h4><p>${esc(e.subject_name||'General')} · ${e.duration_minutes} minutes · ${esc(e.exam_code||'No exam code')}</p><div class="tag-row"><span class="tag">${esc(e.assignment_status)}</span><span class="tag">${e.attempts_used||0} / ${e.max_attempts} attempt(s) used</span><span class="tag">${dateTime(e.opens_at)}</span></div></div>${e.assignment_status==='completed'&&Number(e.attempts_used||0)>=Number(e.max_attempts||1)?'<span class="status graded">ATTEMPTS COMPLETE</span>':`<button class="btn btn-primary" data-start-exam="${e.assignment_id}">${e.assignment_status==='in_progress'?'Resume examination':e.assignment_status==='completed'?'Start next attempt':'View / start exam'}</button>`}</div>`).join('')||'<div class="panel">'+tableEmpty('No examinations assigned','Your examinations will appear here after an administrator assigns them to your account.')+'</div>'}</div>`;
  $$('[data-start-exam]').forEach(b=>b.addEventListener('click',()=>startCandidateExam(b.dataset.startExam)));
}
async function startCandidateExam(assignmentId) {
  if(!confirm('Starting this examination may begin its official timer. Continue?'))return;
  try {
    const {data:sessionId,error}=await state.sb.rpc('begin_exam',{p_assignment_id:assignmentId});if(error)throw error;
    const {data,error:getError}=await state.sb.rpc('get_exam_session',{p_session_id:sessionId});if(getError)throw getError;
    if(data?.expired){showSubmissionResult(data.submission,true);return;}
    state.runner={...data,sessionId,questionIndex:0,flags:new Set(),saving:false};
    await recordEvent('heartbeat',{source:'exam_start'});renderExamRunner();
  } catch(error){toast(errorMessage(error),'error');}
}
function renderExamRunner() {
  clearInterval(state.runnerTimer);const r=state.runner;if(!r)return;
  const q=r.questions[r.questionIndex];const remaining=Number(r.secondsLeft ?? r.session.remaining_seconds ?? 0);r.secondsLeft=remaining;
  app.innerHTML=`<div class="exam-screen"><div id="toast-root" class="toast-root"></div>
    <div class="exam-top"><div class="exam-brand"><img src="/assets/ethan-digital-academy-logo.png" alt=""><div><b>ETHAN CBT · EXAMINATION SESSION</b><small>${esc(r.exam.title)}</small></div></div><div style="display:flex;align-items:center;gap:12px"><span class="status active">SESSION ACTIVE</span><button class="top-signout" id="exam-signout">Sign out</button></div></div>
    <div class="exam-title"><div><h1>${esc(r.exam.title)}</h1><p>Attempt ${r.session.attempt_number} · ${r.questions.length} question(s) · ${state.user?.email}</p></div><div class="timer"><small>TIME REMAINING</small><b id="exam-clock">${clock(remaining)}</b></div></div>
    <div class="exam-grid"><section class="question-card" id="runner-question">${runnerQuestionHTML(q,r)}</section><aside class="question-side"><h3>Question navigator</h3><p>Choose a question number to move through the examination.</p><div class="number-grid" id="runner-nav">${r.questions.map((item,i)=>`<button class="number-btn ${i===r.questionIndex?'current':''} ${hasAnswer(item)?'answered':''} ${r.flags.has(i)?'flagged':''}" data-q-index="${i}">${i+1}</button>`).join('')}</div><div class="notice-strip">Responses save automatically. Keep this window open until you submit.</div><div style="margin-top:15px"><button class="primary-btn full-btn" id="submit-exam">Submit examination</button></div><div class="save-state" id="save-state">Ready</div></aside></div>
    <div class="exam-bottom"><span>ETHAN CBT · Ethan Digital Academy</span><span>Do not close this page until your answers have been submitted.</span></div>
  </div>`;
  $('#exam-signout').addEventListener('click',signOut);$('#submit-exam').addEventListener('click',()=>submitCandidateExam(false));
  $$('[data-q-index]').forEach(b=>b.addEventListener('click',()=>{if(!r.exam.allow_backtrack&&Number(b.dataset.qIndex)<r.questionIndex)return toast('This examination does not allow returning to earlier questions.');r.questionIndex=Number(b.dataset.qIndex);renderExamRunner();}));
  bindRunnerQuestion();
  state.runnerTimer=setInterval(async()=>{if(!state.runner)return;state.runner.secondsLeft=Math.max(0,Number(state.runner.secondsLeft||0)-1);const el=$('#exam-clock');if(el)el.textContent=clock(state.runner.secondsLeft);if(state.runner.secondsLeft===0){clearInterval(state.runnerTimer);await submitCandidateExam(true);}},1000);
  document.removeEventListener('visibilitychange',handleVisibility);document.addEventListener('visibilitychange',handleVisibility);
}
function clock(seconds){return `${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds%3600/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
function savedAnswer(q){return q.saved_answer||{};}
function hasAnswer(q){const a=savedAnswer(q);return (a.selected_option_ids||[]).length>0||Boolean(String(a.answer_text||'').trim());}
function runnerQuestionHTML(q,r){
  const a=savedAnswer(q);const selected=a.selected_option_ids||[];let answer='';
  if(['single_choice','true_false'].includes(q.question_type))answer=`<div class="answer-options">${q.options.map(o=>`<label class="answer-option ${selected.includes(o.id)?'selected':''}"><input type="radio" name="runner-choice" value="${o.id}" ${selected.includes(o.id)?'checked':''}> <b>${esc(o.label)}.</b> ${esc(o.content)}</label>`).join('')}</div>`;
  else if(q.question_type==='multiple_choice')answer=`<div class="answer-options">${q.options.map(o=>`<label class="answer-option ${selected.includes(o.id)?'selected':''}"><input type="checkbox" name="runner-multi" value="${o.id}" ${selected.includes(o.id)?'checked':''}> <b>${esc(o.label)}.</b> ${esc(o.content)}</label>`).join('')}</div>`;
  else answer=`<div class="field"><label>${q.question_type==='essay'?'Your written response':'Your answer'}</label><textarea id="runner-text" rows="${q.question_type==='essay'?9:3}" placeholder="Type your answer here…">${esc(a.answer_text||'')}</textarea><small class="save-state" id="text-save-hint">Your response saves automatically as you type.</small></div>`;
  return `<div class="question-meta"><span>QUESTION ${r.questionIndex+1} OF ${r.questions.length}</span><b>${q.points} MARK(S)</b></div><h2>${esc(q.prompt)}</h2>${q.media_url?`<img src="${esc(q.media_url)}" alt="Question illustration" style="max-width:100%;max-height:280px;object-fit:contain;margin-bottom:16px">`:''}${answer}
    <div class="question-actions"><div class="toolbar"><button class="btn" id="runner-flag">${r.flags.has(r.questionIndex)?'Remove review flag':'⚑ Mark for review'}</button><span class="muted small">${esc(q.question_type.replaceAll('_',' '))}</span></div><div class="toolbar">${r.questionIndex>0&&r.exam.allow_backtrack?'<button class="btn" id="runner-prev">← Previous</button>':''}<button class="btn btn-primary" id="runner-next">${r.questionIndex===r.questions.length-1?'Finish review':'Next question →'}</button></div></div>`;
}
function bindRunnerQuestion() {
  const r=state.runner;if(!r)return;const q=r.questions[r.questionIndex];
  $$('input[name="runner-choice"]').forEach(input=>input.addEventListener('change',async()=>{q.saved_answer={selected_option_ids:[input.value],answer_text:null};renderExamRunner();await saveRunnerAnswer(q);}));
  $$('input[name="runner-multi"]').forEach(input=>input.addEventListener('change',async()=>{const ids=$$('input[name="runner-multi"]:checked').map(x=>x.value);q.saved_answer={selected_option_ids:ids,answer_text:null};renderExamRunner();await saveRunnerAnswer(q);}));
  $('#runner-text')?.addEventListener('input',()=>{
    q.saved_answer={selected_option_ids:[],answer_text:$('#runner-text').value};
    const hint=$('#text-save-hint');if(hint)hint.textContent='Unsaved changes — saving…';
    clearTimeout(state.savingAnswerTimer);
    state.savingAnswerTimer=setTimeout(()=>saveRunnerAnswer(q),650);
  });
  $('#runner-flag')?.addEventListener('click',()=>{r.flags.has(r.questionIndex)?r.flags.delete(r.questionIndex):r.flags.add(r.questionIndex);renderExamRunner();});
  $('#runner-prev')?.addEventListener('click',()=>{r.questionIndex=Math.max(0,r.questionIndex-1);renderExamRunner();});
  $('#runner-next')?.addEventListener('click',()=>{r.questionIndex=Math.min(r.questions.length-1,r.questionIndex+1);renderExamRunner();});
}
async function saveRunnerAnswer(q) {
  const r=state.runner;if(!r)return;
  if(!r.savePromises)r.savePromises=new Map();
  q._saveVersion=(q._saveVersion||0)+1;
  const existing=r.savePromises.get(q.question_id);
  if(existing){
    try{await existing;}catch{/* the initiating call records the save error */}
    if(q._savedVersion!==q._saveVersion&&state.runner===r)return saveRunnerAnswer(q);
    return !q.saveError;
  }
  const saveTask=(async()=>{
    do {
      const version=q._saveVersion;
      const answer=savedAnswer(q);
      const {data,error}=await state.sb.rpc('save_candidate_answer',{
        p_session_id:r.sessionId,
        p_question_id:q.question_id,
        p_selected_option_ids:answer.selected_option_ids||[],
        p_answer_text:answer.answer_text??null
      });
      if(error)throw error;
      q._savedVersion=version;
      q.saveError=null;
      if(data?.status==='time_expired'){r.deadlineExpired=true;break;}
    } while(q._savedVersion!==q._saveVersion);
  })();
  r.savePromises.set(q.question_id,saveTask);
  const status=$('#save-state');if(status)status.textContent='Saving answer…';
  try {
    await saveTask;
    if(status)status.textContent='Answer saved';
    const hint=$('#text-save-hint');if(hint)hint.textContent='Answer saved securely.';
  } catch(error) {
    q.saveError=error;
    if(status)status.textContent='Could not save — check connection';
    const hint=$('#text-save-hint');if(hint)hint.textContent='Could not save. Check your connection and try again.';
    toast(errorMessage(error),'error');
    return false;
  } finally {
    if(r.savePromises.get(q.question_id)===saveTask)r.savePromises.delete(q.question_id);
    if(r.deadlineExpired&&!r.isSubmitting)submitCandidateExam(true);
  }
}

async function submitCandidateExam(auto) {
  const r=state.runner;if(!r||r.isSubmitting)return;
  if(!auto&&!confirm('Submit your examination now? You may not be able to change your answers afterwards.'))return;
  r.isSubmitting=true;
  clearTimeout(state.savingAnswerTimer);
  const currentQuestion=r.questions[r.questionIndex];
  if(!auto&&currentQuestion&&$('#runner-text'))currentQuestion.saved_answer={selected_option_ids:[],answer_text:$('#runner-text').value};
  try {
    // Before an early/manual submission, flush every answered item so fast navigation
    // cannot leave an earlier question's latest selection or written response unsaved.
    if(!auto){
      for(const q of r.questions){
        if(!hasAnswer(q))continue;
        await saveRunnerAnswer(q);
        if(q.saveError&&!r.deadlineExpired)throw new Error('One or more answers have not been saved. Reconnect and try submitting again.');
        if(r.deadlineExpired)break;
      }
    }
    if(!state.runner)return;
    if(!auto&&!r.deadlineExpired&&r.questions.some(q=>hasAnswer(q)&&q.saveError)){
      throw new Error('One or more answers have not been saved. Reconnect and try submitting again.');
    }
    const button=$('#submit-exam');if(button){button.disabled=true;button.textContent='Submitting…';}
    const {data,error}=await state.sb.rpc('submit_exam',{p_session_id:r.sessionId});if(error)throw error;
    clearInterval(state.runnerTimer);document.removeEventListener('visibilitychange',handleVisibility);state.runner=null;showSubmissionResult(data,auto||Boolean(data?.status==='auto_submitted'));
  } catch(error){
    r.isSubmitting=false;
    const button=$('#submit-exam');if(button){button.disabled=false;button.textContent='Submit examination';}
    toast(errorMessage(error),'error');
  }
}
function showSubmissionResult(result,auto=false) {
  clearInterval(state.runnerTimer);document.removeEventListener('visibilitychange',handleVisibility);
  const published=Boolean(result?.published);const manual=Number(result?.manual_questions_pending||0)>0;
  app.innerHTML=`<div id="toast-root" class="toast-root"></div><div class="candidate-results"><div class="eyebrow">EXAMINATION SUBMISSION</div><h1>${auto?'Time expired — examination submitted':'Your examination has been submitted'}</h1><p>${manual?'Your written responses are awaiting examiner marking.':published?'Your result has been released by the institution.':'Your responses have been safely submitted. Your result will appear here when the institution publishes it.'}</p>${published?`<div class="stats" style="grid-template-columns:repeat(2,1fr);margin:22px 0">${statCard('Your score',`${Number(result.total_score??result.objective_score??0).toFixed(2)} / ${Number(result.max_score??0).toFixed(2)}`,'Published score')}${statCard('Outcome',String(result.decision||'pending').toUpperCase(),`${Number(result.percentage||0).toFixed(1)}%`)}</div>`:`<div class="notice-strip" style="margin:18px 0">No score has been disclosed in this response.</div>`}<button class="primary-btn" id="back-candidate">Return to my examinations</button></div>`;
  $('#back-candidate').addEventListener('click',()=>{state.runner=null;state.page='my-exams';renderWorkspace();});
}
async function recordEvent(type,details={}) {
  if(!state.runner)return;
  try{await state.sb.rpc('record_exam_event',{p_session_id:state.runner.sessionId,p_event_type:type,p_details:details});}catch{/* event logging is best-effort; answer saving and exam timing remain authoritative */}
}
function handleVisibility(){if(document.visibilityState==='hidden')recordEvent('tab_blur');else recordEvent('tab_focus');}
window.addEventListener('offline',()=>recordEvent('network_offline'));
window.addEventListener('online',()=>{recordEvent('network_online');const r=state.runner;if(r){(async()=>{for(const q of r.questions){if(q&&hasAnswer(q)){try{await saveRunnerAnswer(q);}catch{/* keep unsaved status visible */}if(r.deadlineExpired)break;}}})().catch(()=>{});}});

async function pageMyResults() {
  const {data,error}=await state.sb.rpc('get_my_published_results');if(error)throw error;
  $('#page-content').innerHTML=`${pageHead('CANDIDATE PORTAL','My results','Results officially released by Ethan Digital Academy.')}
  <section class="panel"><div class="table-wrap"><table><thead><tr><th>Examination</th><th>Score</th><th>Percentage</th><th>Outcome</th><th>Released</th></tr></thead><tbody>${(data||[]).map(r=>`<tr><td><strong>${esc(r.exam_title||'Examination')}</strong></td><td>${Number(r.total_score).toFixed(2)} / ${Number(r.max_score).toFixed(2)}</td><td>${Number(r.percentage||0).toFixed(1)}%</td><td><span class="status ${esc(r.decision)}">${esc(r.decision)}</span></td><td>${dateShort(r.released_at)}</td></tr>`).join('')||`<tr><td colspan="5">${tableEmpty('No published results','When your examination result is released, it will appear here.')}</td></tr>`}</tbody></table></div></section>`;
}

function pageSettings() {
  $('#page-content').innerHTML=`${pageHead('ACCOUNT & PLATFORM','Settings','Your Ethan CBT account and institution access.')}
    <div class="grid-two"><section class="panel"><div class="panel-head"><div><h3>Account information</h3><p>Current signed-in account</p></div></div><div class="panel-body"><div class="metric-row"><div class="metric"><b>${esc(roleLabel(state.role))}</b><span>Assigned role</span></div><div class="metric"><b>${esc(state.membership.institution_name)}</b><span>Institution</span></div></div><p class="small muted" style="margin-top:15px">${esc(state.user?.email)}</p><button class="danger-btn" id="settings-signout">Sign out of this device</button></div></section>
    <section class="panel"><div class="panel-head"><div><h3>Platform details</h3><p>ETHAN CBT infrastructure</p></div></div><div class="panel-body"><p class="small">Application: ${esc(CONFIG.productName)}</p><p class="small">Supabase project: ${esc(CONFIG.supabaseUrl)}</p><p class="small">Database: PostgreSQL 17</p><p class="small muted">The client uses a publishable API key. Examination keys, timing and scoring remain server-side.</p></div></section></div>`;
  $('#settings-signout').addEventListener('click',signOut);
}

function modal(title,body,onSave,saveLabel='Save') {
  const host=$('#modal-root');if(!host)return;
  host.innerHTML=`<div class="modal-backdrop" id="modal-backdrop"><div class="modal"><div class="modal-head"><h3>${esc(title)}</h3><button class="modal-close" id="modal-close" type="button">×</button></div><div class="modal-body">${body}</div><div class="modal-foot"><button class="btn" id="modal-cancel" type="button">Cancel</button><button class="btn btn-primary" id="modal-save" type="button">${esc(saveLabel)}</button></div></div></div>`;
  $('#modal-close').addEventListener('click',closeModal);$('#modal-cancel').addEventListener('click',closeModal);
  $('#modal-backdrop').addEventListener('click',e=>{if(e.target.id==='modal-backdrop')closeModal();});
  $('#modal-save').addEventListener('click',async()=>{const b=$('#modal-save');b.disabled=true;b.textContent='Saving…';try{const result=await onSave();if(result===false){b.disabled=false;b.textContent=saveLabel;}}catch(error){toast(errorMessage(error),'error');b.disabled=false;b.textContent=saveLabel;}});
}
function closeModal(){$('#modal-root').innerHTML='';}
function downloadCSV(name,headers,rows) {
  const cell=v=>`"${String(v??'').replaceAll('"','""')}"`;
  const csv=[headers,...rows].map(row=>row.map(cell).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}

boot().catch(error=>{console.error(error);renderAuth('login',errorMessage(error));});
