// ═══════════════════════════════════════════════════════
// EXPENSE.io — app.js  (API-Connected Version)
// All data operations call the PHP backend via fetch()
// ═══════════════════════════════════════════════════════

const API          = '/api';
const MGR_SECRET   = 'MGR2024';
let currentRole    = 'employee';
let currentUser    = JSON.parse(localStorage.getItem('expensio_user') || 'null');
let authToken      = localStorage.getItem('expensio_token') || null;
let onboardStep    = 1;
let pendingRejectId = null;
let mgrHistFilter  = 'all';

// ──────────────────────────────────────────
// API HELPERS
// ──────────────────────────────────────────
function authHeader() {
  return authToken ? { 'Authorization': 'Bearer ' + authToken } : {};
}
async function apiGet(endpoint) {
  try {
    const res = await fetch(API + endpoint, { headers: { ...authHeader(), 'Content-Type': 'application/json' } });
    if (res.status === 401) { handleLogout(); return null; }
    return await res.json();
  } catch (e) { showToast('Network error — check connection', 'error'); return null; }
}
async function apiPost(endpoint, body) {
  try {
    const res = await fetch(API + endpoint, {
      method: 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (res.status === 401) { handleLogout(); return null; }
    return await res.json();
  } catch (e) { showToast('Network error', 'error'); return null; }
}
async function apiDelete(endpoint) {
  try {
    const res = await fetch(API + endpoint, { method: 'DELETE', headers: { ...authHeader() } });
    return await res.json();
  } catch (e) { showToast('Network error', 'error'); return null; }
}
async function apiPatch(endpoint, body = {}) {
  try {
    const res = await fetch(API + endpoint, {
      method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    return await res.json();
  } catch (e) { showToast('Network error', 'error'); return null; }
}

// ──────────────────────────────────────────
// UTILITIES
// ──────────────────────────────────────────
const avatarColors = ['#7c3aed','#0891b2','#059669','#d97706','#dc2626','#db2777'];
function avatarColor(name) { let h=0; for(let c of (name||'?')) h+=c.charCodeAt(0); return avatarColors[h%avatarColors.length]; }
function initials(name)    { return (name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2); }
function fmt(n)            { return parseFloat(n||0).toFixed(2); }
function today()           { return new Date().toISOString().split('T')[0]; }

function showToast(msg, type='info') {
  const icons  = { success:'fa-check-circle', error:'fa-times-circle', info:'fa-info-circle' };
  const colors = { success:'var(--green)', error:'var(--red)', info:'var(--accent)' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fas ${icons[type]}" style="color:${colors[type]};font-size:15px;"></i> ${msg}`;
  document.getElementById('toastWrap').appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),300); }, 3200);
}

function loadingEl(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div style="text-align:center;padding:50px;color:var(--muted);"><i class="fas fa-circle-notch fa-spin" style="font-size:28px;color:var(--accent);margin-bottom:12px;display:block;"></i>Loading...</div>`;
}

function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  if (id==='expenseModal') {
    document.getElementById('receiptPreview').innerHTML='';
    document.getElementById('expReceipt').value='';
  }
}
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target===m) m.classList.remove('active'); });
});

// Restore session on load
window.addEventListener('DOMContentLoaded', () => {
  if (currentUser && authToken) {
    setRole(currentUser.role);
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    if (currentUser.role === 'manager') {
      launchManager();
    } else {
      document.getElementById('empUserName').textContent = currentUser.name;
      if (currentUser.onboardingComplete) { document.getElementById('employeeDashboard').classList.add('active'); loadEmpPage('home'); }
      else showOnboarding();
    }
  }
});

// ──────────────────────────────────────────
// ROLE + TAB SWITCHING
// ──────────────────────────────────────────
function setRole(role) {
  currentRole = role;
  document.getElementById('roleEmpBtn').classList.toggle('active', role==='employee');
  document.getElementById('roleMgrBtn').classList.toggle('active', role==='manager');
  const isM = role==='manager';
  document.getElementById('loginRoleTag').innerHTML  = isM ? '<i class="fas fa-shield-alt"></i> Manager' : '<i class="fas fa-user"></i> Employee';
  document.getElementById('signupRoleTag').innerHTML = isM ? '<i class="fas fa-shield-alt"></i> Manager Sign Up' : '<i class="fas fa-user"></i> Employee Sign Up';
  document.getElementById('loginRoleTag').className  = isM ? 'role-tag mgr' : 'role-tag';
  document.getElementById('signupRoleTag').className = isM ? 'role-tag mgr' : 'role-tag';
  document.getElementById('mgrCodeGroup').style.display = isM ? 'block' : 'none';
}
function switchTab(tab) {
  const isL = tab==='login';
  document.getElementById('tabLogin').classList.toggle('active', isL);
  document.getElementById('tabSignup').classList.toggle('active', !isL);
  document.getElementById('loginForm').style.display  = isL ? 'block' : 'none';
  document.getElementById('signupForm').style.display = isL ? 'none'  : 'block';
}

// ──────────────────────────────────────────
// AUTH
// ──────────────────────────────────────────
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  if (!email||!pass) { showToast('Please fill all fields','error'); return; }

  const btn = document.querySelector('#loginForm .btn-auth');
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Signing In...'; btn.disabled=true;

  const data = await apiPost('/login.php', { email, password:pass, role:currentRole });
  btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In'; btn.disabled=false;

  if (!data||data.error) { showToast(data?.error||'Login failed','error'); return; }

  authToken = data.token; currentUser = data.user;
  localStorage.setItem('expensio_token', authToken);
  localStorage.setItem('expensio_user', JSON.stringify(currentUser));

  if (currentUser.role==='manager') launchManager();
  else {
    document.getElementById('empUserName').textContent = currentUser.name;
    if (currentUser.onboardingComplete) { showEmpDashboard(); loadEmpPage('home'); }
    else showOnboarding();
  }
}

async function handleSignup() {
  const name  = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const pass  = document.getElementById('signupPassword').value;
  const conf  = document.getElementById('signupConfirm').value;
  const code  = document.getElementById('mgrCode')?.value.trim()||'';
  if (!name||!email||!pass||!conf) { showToast('Please fill all fields','error'); return; }
  if (pass!==conf)   { showToast('Passwords do not match','error'); return; }
  if (pass.length<6) { showToast('Password min 6 characters','error'); return; }

  const btn = document.querySelector('#signupForm .btn-auth');
  btn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Creating...'; btn.disabled=true;
  const data = await apiPost('/signup.php', { name, email, password:pass, role:currentRole, mgrCode:code });
  btn.innerHTML='<i class="fas fa-user-plus"></i> Create Account'; btn.disabled=false;

  if (!data||data.error) { showToast(data?.error||'Signup failed','error'); return; }
  showToast('Account created! Please sign in.','success');
  switchTab('login'); document.getElementById('loginEmail').value=email;
}

async function handleLogout() {
  if (authToken) {
    await fetch(API+'/logout.php',{ method:'POST', headers:{...authHeader(),'Content-Type':'application/json'} }).catch(()=>{});
  }
  authToken=null; currentUser=null; onboardStep=1;
  localStorage.removeItem('expensio_token'); localStorage.removeItem('expensio_user');
  ['loginEmail','loginPassword','signupName','signupEmail','signupPassword','signupConfirm','mgrCode']
    .forEach(id=>{const el=document.getElementById(id); if(el)el.value='';});
  setRole('employee'); switchTab('login');
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('loginPage').classList.add('active');
  showToast('Signed out successfully','info');
}

// ──────────────────────────────────────────
// PAGE TRANSITIONS
// ──────────────────────────────────────────
function showOnboarding()  { document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); document.getElementById('onboardingPage').classList.add('active'); }
function showEmpDashboard(){ document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); document.getElementById('employeeDashboard').classList.add('active'); }
function launchManager() {
  if (!currentUser) return;
  document.getElementById('mgrUserDisplay').textContent = currentUser.name;
  document.getElementById('mgrAva').textContent = initials(currentUser.name);
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('managerDashboard').classList.add('active');
  mgrUpdateBadge(); renderMgrPage('overview');
  showToast('Welcome back, '+currentUser.name.split(' ')[0]+'!','info');
}

// ──────────────────────────────────────────
// ONBOARDING
// ──────────────────────────────────────────
function nextStep(step) {
  if (step===2 && (!document.getElementById('onboardPhone').value||!document.getElementById('onboardDOB').value||!document.getElementById('onboardGender').value)) { showToast('Please fill all fields','error'); return; }
  if (step===3 && (!document.getElementById('onboardCompany').value||!document.getElementById('onboardDepartment').value||!document.getElementById('onboardJobTitle').value)) { showToast('Please fill required fields','error'); return; }
  if (step===4 && (!document.getElementById('onboardAddress').value||!document.getElementById('onboardCity').value||!document.getElementById('onboardState').value||!document.getElementById('onboardPostal').value||!document.getElementById('onboardCountry').value)) { showToast('Please fill all fields','error'); return; }
  document.getElementById('step'+onboardStep).classList.remove('active');
  onboardStep=step;
  document.getElementById('step'+step).classList.add('active');
  document.getElementById('progressFill').style.width=(step/4*100)+'%';
}
function prevStep(step) {
  document.getElementById('step'+onboardStep).classList.remove('active');
  onboardStep=step;
  document.getElementById('step'+step).classList.add('active');
  document.getElementById('progressFill').style.width=(step/4*100)+'%';
}
async function completeOnboarding() {
  const payload = {
    phone:document.getElementById('onboardPhone').value, dob:document.getElementById('onboardDOB').value,
    gender:document.getElementById('onboardGender').value, company:document.getElementById('onboardCompany').value,
    department:document.getElementById('onboardDepartment').value, jobTitle:document.getElementById('onboardJobTitle').value,
    employeeID:document.getElementById('onboardEmployeeID').value, address:document.getElementById('onboardAddress').value,
    city:document.getElementById('onboardCity').value, state:document.getElementById('onboardState').value,
    postal:document.getElementById('onboardPostal').value, country:document.getElementById('onboardCountry').value,
    currency:document.getElementById('onboardCurrency').value, threshold:document.getElementById('onboardThreshold').value,
    emailNotif:document.getElementById('onboardEmailNotif').checked
  };
  const btn=document.querySelector('#step4 .btn-auth');
  btn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Saving...'; btn.disabled=true;
  const data = await apiPost('/onboarding.php', payload);
  btn.innerHTML='<i class="fas fa-check"></i> Complete Setup'; btn.disabled=false;
  if (!data||data.error) { showToast(data?.error||'Failed to save profile','error'); return; }
  currentUser.onboardingComplete=true;
  localStorage.setItem('expensio_user', JSON.stringify(currentUser));
  onboardStep=1; showToast('Profile complete! Welcome to Expensio 🎉','success');
  showEmpDashboard(); document.getElementById('empUserName').textContent=currentUser.name; loadEmpPage('home');
}

// ──────────────────────────────────────────
// EMPLOYEE NAVIGATION
// ──────────────────────────────────────────
function empNav(page, el) {
  document.querySelectorAll('.emp-nav-item').forEach(n=>n.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('.emp-page').forEach(p=>p.classList.remove('active'));
  document.getElementById('emp'+capitalize(page)).classList.add('active');
  loadEmpPage(page);
}
function loadEmpPage(page) {
  const fns={home:renderEmpHome,expenses:renderEmpExpenses,trips:renderEmpTrips,myapprovals:renderEmpMyApprovals,settings:renderEmpSettings,support:renderEmpSupport,profile:renderEmpProfile};
  if(fns[page]) fns[page]();
}
function capitalize(s){return s.charAt(0).toUpperCase()+s.slice(1);}
function toggleEmpSidebar() {
  const sb=document.getElementById('empSidebar'),main=document.getElementById('empMain');
  sb.classList.toggle('collapsed'); sb.classList.toggle('show'); main.classList.toggle('expanded');
}

// ──────────────────────────────────────────
// EMPLOYEE — HOME
// ──────────────────────────────────────────
async function renderEmpHome() {
  loadingEl('empHome');
  const [expenses,trips] = await Promise.all([apiGet('/expenses.php'),apiGet('/trips.php')]);
  const exp=expenses||[], tr=trips||[];
  const pending=exp.filter(e=>e.status==='pending').length;
  const approved=exp.filter(e=>e.status==='approved').length;
  const totalAmt=exp.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  document.getElementById('empHome').innerHTML=`
    <div class="e-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div><h2 style="font-family:var(--font-head);font-size:22px;font-weight:800;">Welcome back, ${currentUser.name.split(' ')[0]}! 👋</h2>
          <p style="color:var(--muted);font-size:14px;margin-top:4px;">Here's your expense overview</p></div>
        <button class="btn-primary-sm" onclick="openModal('expenseModal')"><i class="fas fa-plus"></i> New Expense</button>
      </div>
      <div class="e-task-list">
        <div class="e-task-item" onclick="empNav('myapprovals',null)">
          <div class="e-task-left"><div class="e-task-icon" style="background:#9333ea;"><i class="fas fa-clock"></i></div><span>Pending Approvals</span></div>
          <span class="e-task-count">${pending}</span>
        </div>
        <div class="e-task-item" onclick="empNav('trips',null)">
          <div class="e-task-left"><div class="e-task-icon" style="background:#3b82f6;"><i class="fas fa-plane"></i></div><span>Planned Trips</span></div>
          <span class="e-task-count">${tr.length}</span>
        </div>
        <div class="e-task-item" onclick="empNav('expenses',null)">
          <div class="e-task-left"><div class="e-task-icon" style="background:#ec4899;"><i class="fas fa-credit-card"></i></div><span>Total Expenses</span></div>
          <span class="e-task-count">${exp.length}</span>
        </div>
      </div>
    </div>
    <div class="e-card">
      <h3 class="e-card-title">Quick Actions</h3>
      <div class="e-quick-grid">
        <button class="e-quick-btn" style="background:#ec4899;" onclick="openModal('expenseModal')"><div class="e-quick-icon" style="background:#db2777;"><i class="fas fa-plus"></i></div> New Expense</button>
        <button class="e-quick-btn" style="background:#3b82f6;" onclick="openModal('tripModal')"><div class="e-quick-icon" style="background:#2563eb;"><i class="fas fa-plane"></i></div> Plan Trip</button>
        <button class="e-quick-btn" style="background:#7c3aed;" onclick="empNav('myapprovals',null)"><div class="e-quick-icon" style="background:#6d28d9;"><i class="fas fa-clock"></i></div> My Status</button>
      </div>
    </div>
    <div class="e-stats-grid">
      <div class="e-stat"><div class="e-stat-val">€${fmt(totalAmt)}</div><div class="e-stat-label">Total Spent</div></div>
      <div class="e-stat"><div class="e-stat-val">${pending}</div><div class="e-stat-label">Pending</div></div>
      <div class="e-stat"><div class="e-stat-val">${approved}</div><div class="e-stat-label">Approved</div></div>
      <div class="e-stat"><div class="e-stat-val">${tr.length}</div><div class="e-stat-label">Trips</div></div>
    </div>
    ${exp.length?`<div class="e-card"><h3 class="e-card-title">Recent Expenses</h3><div class="e-table-wrap"><table class="e-table"><thead><tr><th>Date</th><th>Subject</th><th>Category</th><th>Status</th><th style="text-align:right;">Amount</th></tr></thead><tbody>
      ${[...exp].sort((a,b)=>new Date(b.expense_date)-new Date(a.expense_date)).slice(0,5).map(e=>`<tr><td>${e.expense_date}</td><td>${e.subject}</td><td>${e.category}</td><td><span class="badge b-${e.status}">${e.status}</span></td><td style="text-align:right;font-weight:600;">€${fmt(e.amount)}</td></tr>`).join('')}
    </tbody></table></div></div>`:''}`;
}

// ──────────────────────────────────────────
// EMPLOYEE — EXPENSES
// ──────────────────────────────────────────
async function renderEmpExpenses() {
  loadingEl('empExpenses');
  const expenses=await apiGet('/expenses.php')||[];
  window._empExpenses=expenses;
  let rows=!expenses.length
    ? `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted);">No expenses yet. Click "Add Expense" to get started!</td></tr>`
    : [...expenses].sort((a,b)=>new Date(b.expense_date)-new Date(a.expense_date)).map(e=>`
      <tr data-status="${e.status}">
        <td>${e.expense_date}</td><td style="font-weight:500;">${e.subject}</td>
        <td><span class="badge b-info">${e.category}</span></td>
        <td><span class="badge b-${e.status}">${e.status}</span></td>
        <td style="text-align:right;font-weight:700;">€${fmt(e.amount)}</td>
        <td style="text-align:center;">${e.receipt_data?`<button class="btn-view" onclick="viewEmpReceipt(${e.id})"><i class="fas fa-eye"></i> View</button>`:'<span style="color:var(--muted);font-size:11px;">None</span>'}</td>
        <td style="text-align:center;"><button onclick="deleteExpense(${e.id})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:4px 8px;">×</button></td>
      </tr>`).join('');
  document.getElementById('empExpenses').innerHTML=`
    <div class="e-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <h2 class="e-card-title" style="margin:0;">My Expenses</h2>
        <button class="btn-primary-sm" onclick="openModal('expenseModal')"><i class="fas fa-plus"></i> Add Expense</button>
      </div>
      <div class="filter-tabs">
        <button class="filter-tab active" onclick="expFilter('all',this)">All</button>
        <button class="filter-tab" onclick="expFilter('pending',this)">Pending</button>
        <button class="filter-tab" onclick="expFilter('approved',this)">Approved</button>
        <button class="filter-tab" onclick="expFilter('rejected',this)">Rejected</button>
      </div>
      <div class="e-table-wrap"><table class="e-table">
        <thead><tr><th>Date</th><th>Subject</th><th>Category</th><th>Status</th><th style="text-align:right;">Amount</th><th style="text-align:center;">Receipt</th><th></th></tr></thead>
        <tbody id="expTbody">${rows}</tbody>
      </table></div>
    </div>`;
}
function expFilter(status,btn) {
  document.querySelectorAll('.filter-tab').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
  document.querySelectorAll('#expTbody tr').forEach(r=>{r.style.display=(status==='all'||r.dataset.status===status)?'':'none';});
}
async function deleteExpense(id) {
  if(!confirm('Delete this expense?')) return;
  const data=await apiDelete('/expenses.php?id='+id);
  if(data?.success){showToast('Expense deleted','info');renderEmpExpenses();}
  else showToast('Failed to delete','error');
}
function viewEmpReceipt(id) {
  const exp=(window._empExpenses||window._myExpenses||[]).find(e=>e.id==id);
  if(!exp) return;
  showReceiptModal(exp.subject,`€${fmt(exp.amount)} · ${exp.expense_date}`,exp.receipt_data,false);
}

// ──────────────────────────────────────────
// EMPLOYEE — TRIPS
// ──────────────────────────────────────────
async function renderEmpTrips() {
  loadingEl('empTrips');
  const trips=await apiGet('/trips.php')||[];
  document.getElementById('empTrips').innerHTML=`
    <div class="e-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <h2 class="e-card-title" style="margin:0;">My Trips</h2>
        <button class="btn-primary-sm" onclick="openModal('tripModal')"><i class="fas fa-plus"></i> Plan New Trip</button>
      </div>
      ${!trips.length?`<p style="text-align:center;padding:50px 20px;color:var(--muted);">No trips planned yet. Click "Plan New Trip" to start!</p>`:`<div class="trips-grid">${trips.map(t=>`
      <div class="trip-card">
        <button class="trip-del" onclick="deleteTrip(${t.id})">×</button>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;"><i class="fas fa-plane" style="font-size:20px;color:var(--emp-blue);"></i><span class="badge b-planned">${t.status}</span></div>
        <h3 style="font-size:16px;font-weight:700;margin-bottom:6px;">${t.destination}</h3>
        <p style="font-size:12px;color:var(--muted);margin-bottom:10px;">${t.start_date} → ${t.end_date}</p>
        <p style="font-size:13px;color:var(--muted);">${t.purpose}</p>
        <p style="font-size:14px;font-weight:600;color:var(--emp-accent);margin-top:10px;">Budget: €${fmt(t.budget)}</p>
      </div>`).join('')}</div>`}
    </div>`;
}
async function deleteTrip(id) {
  if(!confirm('Delete this trip?')) return;
  const data=await apiDelete('/trips.php?id='+id);
  if(data?.success){showToast('Trip deleted','info');renderEmpTrips();}
  else showToast('Failed to delete','error');
}

// ──────────────────────────────────────────
// EMPLOYEE — MY APPROVALS STATUS
// ──────────────────────────────────────────
async function renderEmpMyApprovals() {
  loadingEl('empMyapprovals');
  const expenses=await apiGet('/expenses.php')||[];
  window._myExpenses=expenses;
  document.getElementById('empMyapprovals').innerHTML=`
    <div class="e-card">
      <h2 class="e-card-title">My Approval Status</h2>
      <p style="color:var(--muted);font-size:13px;margin-bottom:20px;">Track the status of all your submitted expenses</p>
      ${!expenses.length
        ? `<div style="text-align:center;padding:50px;color:var(--muted);"><i class="fas fa-inbox" style="font-size:40px;margin-bottom:14px;display:block;"></i><p>No expenses submitted yet.</p></div>`
        : [...expenses].sort((a,b)=>new Date(b.expense_date)-new Date(a.expense_date)).map(e=>`
      <div class="approval-row">
        <div class="approval-info">
          <h4>${e.subject}</h4><p>${e.category} · ${e.expense_date}</p>
          ${e.reject_reason?`<p style="color:var(--red);font-size:12px;margin-top:4px;"><i class="fas fa-info-circle"></i> ${e.reject_reason}</p>`:''}
        </div>
        <div class="approval-right">
          <span class="approval-amt">€${fmt(e.amount)}</span>
          ${e.receipt_data?`<button class="btn-view" onclick="viewEmpReceipt(${e.id})"><i class="fas fa-eye"></i> Receipt</button>`:''}
          <span class="badge b-${e.status}">${e.status.charAt(0).toUpperCase()+e.status.slice(1)}</span>
        </div>
      </div>`).join('')}
    </div>
    <div class="e-card">
      <h3 style="font-family:var(--font-head);font-size:16px;font-weight:700;margin-bottom:16px;"><i class="fas fa-info-circle" style="color:var(--accent);"></i> How It Works</h3>
      ${[['Submit','Submit your expense with a receipt attached',1,'#ec4899'],['Review','Your manager reviews your expense and receipt',2,'#f59e0b'],['Decision','Manager approves or rejects with a reason',3,'#00c896']].map(([t,d,n,c])=>`
      <div style="display:flex;gap:12px;margin-bottom:14px;">
        <div style="width:30px;height:30px;border-radius:50%;background:${c};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex-shrink:0;">${n}</div>
        <div><h4 style="font-weight:600;margin-bottom:3px;">${t}</h4><p style="color:var(--muted);font-size:13px;">${d}</p></div>
      </div>`).join('')}
    </div>`;
}

// ──────────────────────────────────────────
// EMPLOYEE — SETTINGS
// ──────────────────────────────────────────
async function renderEmpSettings() {
  loadingEl('empSettings');
  const p=await apiGet('/profile.php')||{};
  document.getElementById('empSettings').innerHTML=`
    <div class="e-card" style="max-width:560px;">
      <h2 class="e-card-title">Account Settings</h2>
      <h4 style="margin-bottom:16px;color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Profile</h4>
      <div class="form-group"><label>Full Name</label><div class="input-wrap"><i class="fas fa-user"></i><input type="text" id="setName" value="${p.name||currentUser.name}"></div></div>
      <div class="form-group"><label>Phone</label><div class="input-wrap"><i class="fas fa-phone"></i><input type="tel" id="setPhone" value="${p.phone||''}"></div></div>
      <div class="form-group"><label>Job Title</label><div class="input-wrap"><i class="fas fa-briefcase"></i><input type="text" id="setJobTitle" value="${p.job_title||''}"></div></div>
      <h4 style="margin:20px 0 16px;color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Company</h4>
      <div class="form-group"><label>Company Name</label><div class="input-wrap"><i class="fas fa-building"></i><input type="text" id="setCompany" value="${p.company||''}"></div></div>
      <div class="form-group"><label>Department</label><div class="input-wrap"><i class="fas fa-sitemap"></i><select id="setDept" class="sel-pad">${['Marketing','Sales','Operations','Finance','HR','IT','Other'].map(d=>`<option ${p.department===d?'selected':''}>${d}</option>`).join('')}</select></div></div>
      <div class="form-group"><label>Employee ID</label><div class="input-wrap"><i class="fas fa-id-card"></i><input type="text" id="setEmpID" value="${p.employee_id||''}"></div></div>
      <h4 style="margin:20px 0 16px;color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Preferences</h4>
      <div class="form-group"><label>Currency</label><div class="input-wrap"><i class="fas fa-coins"></i><select id="setCurrency" class="sel-pad">${['EUR (€)','USD ($)','GBP (£)','JPY (¥)','INR (₹)'].map(c=>`<option ${p.default_currency===c?'selected':''}>${c}</option>`).join('')}</select></div></div>
      <div class="form-group"><label>Threshold (€)</label><div class="input-wrap"><i class="fas fa-euro-sign"></i><input type="number" id="setThreshold" value="${p.approval_threshold||500}"></div></div>
      <div style="display:flex;gap:10px;margin-top:8px;"><button class="btn-auth" style="max-width:180px;" onclick="saveEmpSettings()"><i class="fas fa-save"></i> Save</button></div>
    </div>`;
}
async function saveEmpSettings() {
  const body={name:document.getElementById('setName').value.trim(),phone:document.getElementById('setPhone').value,jobTitle:document.getElementById('setJobTitle').value,company:document.getElementById('setCompany').value,department:document.getElementById('setDept').value,employeeID:document.getElementById('setEmpID').value,currency:document.getElementById('setCurrency').value,threshold:document.getElementById('setThreshold').value};
  const data=await apiPost('/profile.php',body);
  if(data?.success){currentUser.name=body.name||currentUser.name;localStorage.setItem('expensio_user',JSON.stringify(currentUser));document.getElementById('empUserName').textContent=currentUser.name;showToast('Settings saved!','success');}
  else showToast(data?.error||'Failed to save','error');
}

// ──────────────────────────────────────────
// EMPLOYEE — SUPPORT
// ──────────────────────────────────────────
function renderEmpSupport() {
  document.getElementById('empSupport').innerHTML=`
    <div class="e-card" style="max-width:600px;">
      <h2 class="e-card-title">Support Center</h2>
      <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:28px;">
        ${[['fa-phone','Phone','+1 (555) 123-4567'],['fa-envelope','Email','support@expensio.com'],['fa-clock','Hours','Mon–Fri, 9AM–6PM EST']].map(([ic,l,v])=>`
        <div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--surface2);border-radius:10px;">
          <i class="fas ${ic}" style="color:var(--accent);font-size:18px;width:24px;text-align:center;"></i>
          <div><div style="font-size:12px;color:var(--muted);margin-bottom:2px;">${l}</div><div style="font-weight:500;">${v}</div></div>
        </div>`).join('')}
      </div>
      <h3 style="font-family:var(--font-head);font-size:16px;font-weight:700;margin-bottom:16px;">Send a Message</h3>
      <div class="form-group"><label>Subject</label><div class="input-wrap"><i class="fas fa-tag"></i><input type="text" id="supSubject" placeholder="What do you need help with?"></div></div>
      <div class="form-group"><label>Category</label><div class="input-wrap"><i class="fas fa-folder"></i><select id="supCat" class="sel-pad"><option>Technical Issue</option><option>Billing Question</option><option>Feature Request</option><option>Account Problem</option><option>General Inquiry</option></select></div></div>
      <div class="form-group"><label>Message</label><textarea id="supMsg" style="width:100%;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--font-body);font-size:14px;resize:vertical;min-height:100px;" placeholder="Describe your issue..."></textarea></div>
      <button class="btn-auth" style="max-width:200px;" onclick="sendSupport()"><i class="fas fa-paper-plane"></i> Send Message</button>
    </div>
    <div class="e-card" style="max-width:600px;">
      <h3 style="font-family:var(--font-head);font-size:16px;font-weight:700;margin-bottom:16px;">FAQ</h3>
      ${[['How do I submit an expense?','Click "Add Expense", fill in details, and upload your receipt.'],['How long does approval take?','Your manager typically reviews within 24–48 hours.'],['Can I edit a submitted expense?','Delete and resubmit expenses in "Pending" status.'],['How do I plan a business trip?','Go to the Trips page and click "Plan New Trip".']].map(([q,a])=>`
      <div style="padding:14px;background:var(--surface2);border-radius:10px;margin-bottom:10px;">
        <h4 style="font-weight:600;margin-bottom:6px;">${q}</h4><p style="color:var(--muted);font-size:13px;">${a}</p>
      </div>`).join('')}
    </div>`;
}
async function sendSupport() {
  const subject=document.getElementById('supSubject').value.trim();
  const category=document.getElementById('supCat').value;
  const message=document.getElementById('supMsg').value.trim();
  if(!subject||!message){showToast('Please fill subject and message','error');return;}
  const data=await apiPost('/support.php',{subject,category,message});
  if(data?.success){document.getElementById('supSubject').value='';document.getElementById('supMsg').value='';showToast("Message sent! We'll respond within 24 hours.",'success');}
  else showToast(data?.error||'Failed to send','error');
}

// ──────────────────────────────────────────
// EMPLOYEE — PROFILE
// ──────────────────────────────────────────
async function renderEmpProfile() {
  loadingEl('empProfile');
  const [p,expenses,trips]=await Promise.all([apiGet('/profile.php'),apiGet('/expenses.php'),apiGet('/trips.php')]);
  const prof=p||{}, exp=expenses||[], tr=trips||[];
  document.getElementById('empProfile').innerHTML=`
    <div class="e-card">
      <h2 class="e-card-title">Your Profile</h2>
      <div style="display:flex;gap:24px;margin-bottom:28px;flex-wrap:wrap;align-items:center;">
        <div style="width:100px;height:100px;background:linear-gradient(135deg,var(--emp-accent),var(--emp-blue));border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--font-head);font-size:36px;font-weight:800;color:#fff;flex-shrink:0;">${initials(currentUser.name)}</div>
        <div>
          <h3 style="font-size:24px;font-weight:800;margin-bottom:4px;">${currentUser.name}</h3>
          <p style="color:var(--muted);margin-bottom:3px;">${currentUser.email}</p>
          <p style="color:var(--muted);font-size:13px;">${prof.job_title||'No job title'} · ${prof.company||'No company'}</p>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
            <span class="badge b-info">Active</span><span class="badge b-approved">Verified</span>
            ${currentUser.onboardingComplete?'<span class="badge b-planned">Profile Complete</span>':''}
          </div>
        </div>
      </div>
      <div class="e-stats-grid">
        <div class="e-stat"><div class="e-stat-val">€${fmt(exp.reduce((s,e)=>s+parseFloat(e.amount||0),0))}</div><div class="e-stat-label">Total Expenses</div></div>
        <div class="e-stat"><div class="e-stat-val">${exp.length}</div><div class="e-stat-label">Submitted</div></div>
        <div class="e-stat"><div class="e-stat-val">${exp.filter(e=>e.status==='approved').length}</div><div class="e-stat-label">Approved</div></div>
        <div class="e-stat"><div class="e-stat-val">${tr.length}</div><div class="e-stat-label">Trips</div></div>
      </div>
      <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-primary-sm" onclick="empNav('settings',null)"><i class="fas fa-edit"></i> Edit Profile</button>
        <button class="btn-danger" onclick="handleLogout()"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>
    </div>`;
}

// ──────────────────────────────────────────
// EXPENSE / TRIP SUBMISSION
// ──────────────────────────────────────────
function previewReceipt(input) {
  const prev=document.getElementById('receiptPreview'); prev.innerHTML='';
  if(!input.files||!input.files[0]) return;
  const file=input.files[0];
  if(file.size>5*1024*1024){showToast('File too large — max 5MB','error');input.value='';return;}
  const reader=new FileReader();
  reader.onload=e=>{
    const isImg=file.type.startsWith('image/'), isPDF=file.type==='application/pdf';
    prev.innerHTML=isImg
      ?`<div style="margin-top:10px;"><img src="${e.target.result}" style="max-width:100%;max-height:180px;border-radius:8px;border:2px solid var(--green);display:block;"><p style="font-size:12px;color:var(--green);margin-top:6px;"><i class="fas fa-check-circle"></i> ${file.name}</p></div>`
      :`<div style="margin-top:10px;padding:12px;background:var(--surface2);border-radius:8px;border:2px solid var(--green);"><i class="fas fa-file-${isPDF?'pdf':'alt'}" style="color:var(--red);font-size:20px;"></i> <span style="color:var(--green);"><i class="fas fa-check-circle"></i> ${file.name}</span></div>`;
  };
  reader.readAsDataURL(file);
}

async function submitExpense() {
  const subject=document.getElementById('expSubject').value.trim();
  const category=document.getElementById('expCategory').value;
  const amount=document.getElementById('expAmount').value;
  const date=document.getElementById('expDate').value;
  const fileInput=document.getElementById('expReceipt');
  if(!subject||!amount||!date){showToast('Please fill all required fields','error');return;}
  if(!fileInput.files||!fileInput.files[0]){showToast('Receipt is required — please upload a bill or receipt','error');return;}
  const btn=document.querySelector('#expenseModal .btn-auth');
  btn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Submitting...'; btn.disabled=true;
  const reader=new FileReader();
  reader.onload=async e=>{
    const data=await apiPost('/expenses.php',{subject,category,amount:parseFloat(amount),date,receipt:e.target.result});
    btn.innerHTML='<i class="fas fa-paper-plane"></i> Submit Expense'; btn.disabled=false;
    if(data?.success){closeModal('expenseModal');showToast('Expense submitted for approval!','success');renderEmpExpenses();mgrUpdateBadge();}
    else showToast(data?.error||'Failed to submit','error');
  };
  reader.readAsDataURL(fileInput.files[0]);
}

async function submitTrip() {
  const dest=document.getElementById('tripDest').value.trim(),purpose=document.getElementById('tripPurpose').value.trim();
  const start=document.getElementById('tripStart').value,end=document.getElementById('tripEnd').value,budget=document.getElementById('tripBudget').value;
  if(!dest||!purpose||!start||!end||!budget){showToast('Please fill all fields','error');return;}
  const btn=document.querySelector('#tripModal .btn-auth');
  btn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Saving...'; btn.disabled=true;
  const data=await apiPost('/trips.php',{destination:dest,purpose,startDate:start,endDate:end,budget:parseFloat(budget)});
  btn.innerHTML='<i class="fas fa-plane"></i> Plan Trip'; btn.disabled=false;
  if(data?.success){['tripDest','tripPurpose','tripStart','tripEnd','tripBudget'].forEach(id=>{document.getElementById(id).value='';});closeModal('tripModal');showToast('Trip planned!','success');renderEmpTrips();}
  else showToast(data?.error||'Failed to save trip','error');
}

// Shared receipt viewer
function showReceiptModal(title, sub, receiptData, showActions, expId) {
  document.getElementById('rvTitle').textContent=title;
  document.getElementById('rvSub').textContent=sub;
  const vc=document.getElementById('rvContent');
  if(receiptData){
    const isImg=receiptData.startsWith('data:image');
    vc.innerHTML=isImg?`<img src="${receiptData}" style="max-width:100%;max-height:420px;" />`:`<iframe src="${receiptData}" style="width:100%;height:400px;border:none;"></iframe>`;
  } else {
    vc.innerHTML=`<div style="padding:40px;text-align:center;color:var(--muted);"><i class="fas fa-file-slash" style="font-size:36px;display:block;margin-bottom:12px;"></i>No receipt uploaded.</div>`;
  }
  document.getElementById('rvActions').innerHTML=showActions&&expId
    ?`<button class="btn-approve" style="flex:1;" onclick="closeModal('receiptViewModal');quickApprove(${expId})"><i class="fas fa-check"></i> Approve</button>
      <button class="btn-reject" style="flex:1;" onclick="closeModal('receiptViewModal');openRejectModal(${expId})"><i class="fas fa-times"></i> Reject</button>`
    :`<button class="btn-secondary" onclick="closeModal('receiptViewModal')">Close</button>`;
  openModal('receiptViewModal');
}

// ──────────────────────────────────────────
// MANAGER NAVIGATION
// ──────────────────────────────────────────
const mgrPageMeta={overview:['Overview','Your expense management summary'],pending:['Pending Approvals','Expenses waiting for your review'],history:['Approval History','All processed expense requests'],employees:['Employees','Expense activity by team member'],analytics:['Analytics','Spending trends and insights'],mgrsettings:['Settings','Configure your manager preferences']};

function mgrNav(page,el) {
  document.querySelectorAll('.mgr-nav-item').forEach(n=>n.classList.remove('active'));
  if(el)el.classList.add('active');
  document.querySelectorAll('.mgr-page').forEach(p=>p.classList.remove('active'));
  document.getElementById('mgr'+capitalize(page)).classList.add('active');
  const[title,sub]=mgrPageMeta[page]||[page,''];
  document.getElementById('mgrTitle').textContent=title;
  document.getElementById('mgrSub').textContent=sub;
  renderMgrPage(page);
}
function renderMgrPage(page){
  const fns={overview:renderMgrOverview,pending:renderMgrPending,history:renderMgrHistory,employees:renderMgrEmployees,analytics:renderMgrAnalytics,mgrsettings:renderMgrSettings};
  if(fns[page])fns[page]();
}
async function mgrUpdateBadge() {
  if(!currentUser||currentUser.role!=='manager') return;
  const data=await apiGet('/expenses.php');
  const count=(data||[]).filter(e=>e.status==='pending').length;
  const el=document.getElementById('mgrPendingCount');
  if(el){el.textContent=count;el.style.display=count>0?'':'none';}
}

// ──────────────────────────────────────────
// MANAGER — OVERVIEW
// ──────────────────────────────────────────
async function renderMgrOverview() {
  loadingEl('mgrOverview');
  const all=await apiGet('/expenses.php')||[];
  window._mgrExpenses=all;
  const pending=all.filter(e=>e.status==='pending'),approved=all.filter(e=>e.status==='approved'),rejected=all.filter(e=>e.status==='rejected');
  const totalAmt=approved.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const pendAmt=pending.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const threshold=currentUser?.threshold||500;
  const catColors={Supplies:'#00e5ff',Meals:'#7c3aed',Travel:'#00c896',Technology:'#ffb020',Marketing:'#ff4560',Other:'#888'};
  const cats={};approved.forEach(e=>{cats[e.category]=(cats[e.category]||0)+parseFloat(e.amount||0);});
  const maxC=Math.max(...Object.values(cats),1);
  const recent=[...all].filter(e=>e.status!=='pending').sort((a,b)=>new Date(b.reviewed_at||b.expense_date)-new Date(a.reviewed_at||a.expense_date)).slice(0,5);

  document.getElementById('mgrOverview').innerHTML=`
    <div class="m-stats-row">
      ${[['fa-clock','Pending Review',pending.length,'si-amber'],['fa-check-circle','Approved',approved.length,'si-green'],['fa-times-circle','Rejected',rejected.length,'si-red'],['fa-euro-sign','Total Approved','€'+fmt(totalAmt),'si-cyan'],['fa-hourglass-half','Awaiting','€'+fmt(pendAmt),'si-purple']].map(([ic,lb,val,cls])=>`
      <div class="m-stat-card"><div class="m-stat-icon ${cls}"><i class="fas ${ic}"></i></div><div class="m-stat-val">${val}</div><div class="m-stat-label">${lb}</div></div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div class="m-card">
        <div class="m-card-hdr"><span class="m-card-title">Needs Approval</span><button class="btn-view" onclick="mgrNav('pending',document.querySelectorAll('.mgr-nav-item')[1])">View All</button></div>
        ${pending.length===0?`<div class="empty-state" style="padding:30px 0;"><i class="fas fa-check-circle"></i><h3>All clear!</h3></div>`:
        pending.slice(0,4).map(e=>`
        <div class="m-approval-card" id="oc-${e.id}">
          <div class="m-appr-left">
            <div class="m-appr-ava" style="background:${avatarColor(e.employee_name||'')}22;color:${avatarColor(e.employee_name||'')}">${initials(e.employee_name||'')}</div>
            <div class="m-appr-info"><h4>${e.subject}</h4><p>${e.employee_name} · ${e.category} · ${e.expense_date}</p></div>
          </div>
          <div class="m-appr-right">
            <span class="m-appr-amt ${parseFloat(e.amount)>threshold?'high-val':''}">€${fmt(e.amount)}</span>
            <button class="btn-approve" onclick="quickApprove(${e.id},'oc-')"><i class="fas fa-check"></i></button>
            <button class="btn-reject" onclick="openRejectModal(${e.id})"><i class="fas fa-times"></i></button>
          </div>
        </div>`).join('')}
      </div>
      <div>
        <div class="m-card">
          <div class="m-card-hdr"><span class="m-card-title">Spend by Category</span></div>
          ${Object.keys(cats).length===0?`<p style="color:var(--muted);text-align:center;padding:20px;font-size:13px;">No approved expenses yet.</p>`:
          Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>`
          <div class="chart-row"><div class="chart-label">${cat}</div><div class="chart-track"><div class="chart-fill" style="width:${(amt/maxC*100).toFixed(0)}%;background:${catColors[cat]||'#888'};"></div></div><div class="chart-val" style="color:${catColors[cat]||'#888'};">€${fmt(amt)}</div></div>`).join('')}
        </div>
        <div class="m-card">
          <div class="m-card-hdr"><span class="m-card-title">Recent Activity</span></div>
          ${recent.length===0?`<p style="color:var(--muted);text-align:center;padding:20px;font-size:13px;">No activity yet.</p>`:
          recent.map(e=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:10px;"><div style="width:8px;height:8px;border-radius:50%;background:${e.status==='approved'?'var(--green)':'var(--red)'};"></div>
            <div><div style="font-size:13px;font-weight:500;">${e.subject}</div><div style="font-size:11px;color:var(--muted);">${e.employee_name}</div></div></div>
            <span class="badge b-${e.status}">${e.status}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
}

// ──────────────────────────────────────────
// MANAGER — PENDING
// ──────────────────────────────────────────
async function renderMgrPending() {
  loadingEl('mgrPending');
  const all=await apiGet('/expenses.php')||[];
  window._mgrExpenses=all;
  const threshold=currentUser?.threshold||500;
  const search=(document.getElementById('mgrSearch')?.value||'').toLowerCase();
  const catF=document.getElementById('mgrCatFilter')?.value||'';
  let pending=all.filter(e=>e.status==='pending');
  if(search)pending=pending.filter(e=>e.subject.toLowerCase().includes(search)||(e.employee_name||'').toLowerCase().includes(search));
  if(catF)pending=pending.filter(e=>e.category===catF);

  document.getElementById('mgrPending').innerHTML=`
    <div class="m-card">
      <div class="m-card-hdr">
        <span class="m-card-title">Pending Approvals (${pending.length})</span>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <div class="search-bar"><i class="fas fa-search"></i><input type="text" id="mgrSearch" placeholder="Search..." oninput="renderMgrPending()"></div>
          <select id="mgrCatFilter" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:9px 12px;border-radius:10px;font-family:var(--font-body);font-size:13px;" onchange="renderMgrPending()">
            <option value="">All Categories</option>${['Supplies','Meals','Travel','Technology','Marketing','Other'].map(c=>`<option>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      ${pending.length===0?`<div class="empty-state"><i class="fas fa-check-circle"></i><h3>All caught up!</h3><p>No pending expenses match your filter.</p></div>`:
      pending.map(e=>`
      <div class="m-approval-card" id="pc-${e.id}">
        <div class="m-appr-left">
          <div class="m-appr-ava" style="background:${avatarColor(e.employee_name||'')}22;color:${avatarColor(e.employee_name||'')}">${initials(e.employee_name||'')}</div>
          <div class="m-appr-info">
            <h4>${e.subject} ${parseFloat(e.amount)>threshold?'<span class="badge b-pending" style="font-size:10px;margin-left:6px;">High Value</span>':''}</h4>
            <p>${e.employee_name} &nbsp;·&nbsp; ${e.category} &nbsp;·&nbsp; ${e.expense_date}</p>
          </div>
        </div>
        <div class="m-appr-right">
          <span class="m-appr-amt ${parseFloat(e.amount)>threshold?'high-val':''}">€${fmt(e.amount)}</span>
          ${e.receipt_data?`<button class="btn-view" onclick="mgrViewReceipt(${e.id},true)"><i class="fas fa-file-invoice"></i> Receipt</button>`:`<span style="font-size:11px;color:var(--muted);">No receipt</span>`}
          <button class="btn-approve" onclick="quickApprove(${e.id},'pc-')"><i class="fas fa-check"></i> Approve</button>
          <button class="btn-reject" onclick="openRejectModal(${e.id})"><i class="fas fa-times"></i> Reject</button>
        </div>
      </div>`).join('')}
    </div>`;
}

// ──────────────────────────────────────────
// MANAGER — HISTORY
// ──────────────────────────────────────────
async function renderMgrHistory() {
  loadingEl('mgrHistory');
  const all=await apiGet('/expenses.php')||[];
  window._mgrExpenses=all;
  const search=(document.getElementById('mgrHistSearch')?.value||'').toLowerCase();
  let rows=all.filter(e=>e.status!=='pending');
  if(mgrHistFilter!=='all')rows=rows.filter(e=>e.status===mgrHistFilter);
  if(search)rows=rows.filter(e=>e.subject.toLowerCase().includes(search)||(e.employee_name||'').toLowerCase().includes(search));
  rows.sort((a,b)=>new Date(b.reviewed_at||b.expense_date)-new Date(a.reviewed_at||a.expense_date));

  document.getElementById('mgrHistory').innerHTML=`
    <div class="m-card">
      <div class="m-card-hdr">
        <span class="m-card-title">Approval History</span>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <div class="filter-tabs">
            <button class="filter-tab active" onclick="mgrHistFilter='all';renderMgrHistory();document.querySelectorAll('.filter-tab').forEach(b=>b.classList.remove('active'));this.classList.add('active');">All</button>
            <button class="filter-tab" onclick="mgrHistFilter='approved';renderMgrHistory();document.querySelectorAll('.filter-tab').forEach(b=>b.classList.remove('active'));this.classList.add('active');">Approved</button>
            <button class="filter-tab" onclick="mgrHistFilter='rejected';renderMgrHistory();document.querySelectorAll('.filter-tab').forEach(b=>b.classList.remove('active'));this.classList.add('active');">Rejected</button>
          </div>
          <div class="search-bar"><i class="fas fa-search"></i><input type="text" id="mgrHistSearch" placeholder="Search..." oninput="renderMgrHistory()"></div>
        </div>
      </div>
      <div style="overflow-x:auto;"><table class="m-table">
        <thead><tr><th>Employee</th><th>Expense</th><th>Category</th><th>Amount</th><th>Date</th><th>Status</th><th>Receipt</th><th>Action By</th></tr></thead>
        <tbody>${rows.length===0?`<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--muted);">No records found.</td></tr>`:
        rows.map(e=>`<tr>
          <td><div class="emp-chip"><div class="emp-mini-ava" style="background:${avatarColor(e.employee_name||'')}22;color:${avatarColor(e.employee_name||'')}">${initials(e.employee_name||'')}</div>${e.employee_name}</div></td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.subject}</td>
          <td><span class="badge b-info">${e.category}</span></td>
          <td style="font-weight:700;">€${fmt(e.amount)}</td>
          <td style="color:var(--muted);">${e.expense_date}</td>
          <td><span class="badge b-${e.status}">${e.status}</span></td>
          <td>${e.receipt_data?`<button class="btn-view" onclick="mgrViewReceipt(${e.id},false)"><i class="fas fa-eye"></i> View</button>`:'<span style="color:var(--muted);">—</span>'}</td>
          <td style="color:var(--muted);font-size:12px;">${e.action_by||'—'}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
}

// ──────────────────────────────────────────
// MANAGER — EMPLOYEES
// ──────────────────────────────────────────
async function renderMgrEmployees() {
  loadingEl('mgrEmployees');
  const all=await apiGet('/expenses.php')||[];
  window._mgrExpenses=all;
  const search=(document.getElementById('mgrEmpSearch')?.value||'').toLowerCase();
  const empMap={};
  all.forEach(e=>{const key=e.employee_email||e.employee_name;if(!empMap[key])empMap[key]={name:e.employee_name||'',email:e.employee_email||'',expenses:[]};empMap[key].expenses.push(e);});
  let emps=Object.values(empMap);
  if(search)emps=emps.filter(em=>em.name.toLowerCase().includes(search)||em.email.toLowerCase().includes(search));

  document.getElementById('mgrEmployees').innerHTML=`
    <div class="m-card">
      <div class="m-card-hdr"><span class="m-card-title">Employee Expense Summary</span>
        <div class="search-bar"><i class="fas fa-search"></i><input type="text" id="mgrEmpSearch" placeholder="Search employees..." oninput="renderMgrEmployees()"></div>
      </div>
      <div style="overflow-x:auto;"><table class="m-table">
        <thead><tr><th>Employee</th><th>Submitted</th><th>Approved</th><th>Rejected</th><th>Pending</th><th>Total Approved</th><th>Actions</th></tr></thead>
        <tbody>${emps.length===0?`<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted);">No employees found.</td></tr>`:
        emps.map(em=>{
          const appr=em.expenses.filter(e=>e.status==='approved'),rejc=em.expenses.filter(e=>e.status==='rejected'),pend=em.expenses.filter(e=>e.status==='pending');
          const tot=appr.reduce((s,e)=>s+parseFloat(e.amount||0),0);
          return `<tr>
            <td><div class="emp-chip"><div class="emp-mini-ava" style="background:${avatarColor(em.name)}22;color:${avatarColor(em.name)}">${initials(em.name)}</div><div><div style="font-weight:500;">${em.name}</div><div style="font-size:11px;color:var(--muted);">${em.email}</div></div></div></td>
            <td style="font-weight:600;">${em.expenses.length}</td><td style="color:var(--green);font-weight:600;">${appr.length}</td>
            <td style="color:var(--red);">${rejc.length}</td><td><span class="badge b-pending">${pend.length}</span></td>
            <td style="font-weight:700;">€${fmt(tot)}</td>
            <td><button class="btn-view" onclick="openEmpDetail('${em.email}')"><i class="fas fa-eye"></i> Details</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`;
}

function openEmpDetail(email) {
  const all=window._mgrExpenses||[];
  const emExps=all.filter(e=>(e.employee_email||'')==email);
  if(!emExps.length)return;
  const name=emExps[0].employee_name||'Unknown';
  document.getElementById('empDetailName').textContent=name;
  document.getElementById('empDetailEmail').textContent=email;
  document.getElementById('empDetailContent').innerHTML=`
    <div style="overflow-x:auto;"><table class="m-table">
      <thead><tr><th>Subject</th><th>Category</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
      <tbody>${[...emExps].sort((a,b)=>new Date(b.expense_date)-new Date(a.expense_date)).map(e=>`
      <tr><td>${e.subject}</td><td><span class="badge b-info">${e.category}</span></td><td style="font-weight:600;">€${fmt(e.amount)}</td><td style="color:var(--muted);">${e.expense_date}</td><td><span class="badge b-${e.status}">${e.status}</span></td></tr>`).join('')}
      </tbody>
    </table></div>`;
  openModal('empDetailModal');
}

// ──────────────────────────────────────────
// MANAGER — ANALYTICS
// ──────────────────────────────────────────
async function renderMgrAnalytics() {
  loadingEl('mgrAnalytics');
  const all=await apiGet('/expenses.php')||[];
  window._mgrExpenses=all;
  const approved=all.filter(e=>e.status==='approved'),rejected=all.filter(e=>e.status==='rejected');
  const total=approved.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const done=all.filter(e=>e.status!=='pending');
  const rate=done.length>0?Math.round(approved.length/done.length*100):0;
  const cColors={Supplies:'#00e5ff',Meals:'#7c3aed',Travel:'#00c896',Technology:'#ffb020',Marketing:'#ff4560',Other:'#888'};
  const cats={};all.forEach(e=>{cats[e.category]=(cats[e.category]||0)+parseFloat(e.amount||0);});
  const maxC=Math.max(...Object.values(cats),1);
  const empStats={};
  done.forEach(e=>{const k=e.employee_name||'Unknown';if(!empStats[k])empStats[k]={approved:0,total:0};empStats[k].total++;if(e.status==='approved')empStats[k].approved++;});
  const months={};
  approved.forEach(e=>{const m=e.expense_date.slice(0,7);months[m]=(months[m]||0)+parseFloat(e.amount||0);});
  const maxM=Math.max(...Object.values(months),1);

  document.getElementById('mgrAnalytics').innerHTML=`
    <div class="m-stats-row">
      ${[['fa-euro-sign','Total Approved','€'+fmt(total),'si-green'],['fa-percentage','Approval Rate',rate+'%','si-cyan'],['fa-calculator','Avg Approved','€'+fmt(approved.length?total/approved.length:0),'si-amber'],['fa-ban','Total Rejected',rejected.length,'si-red']].map(([ic,lb,val,cls])=>`
      <div class="m-stat-card"><div class="m-stat-icon ${cls}"><i class="fas ${ic}"></i></div><div class="m-stat-val">${val}</div><div class="m-stat-label">${lb}</div></div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div class="m-card"><div class="m-card-hdr"><span class="m-card-title">Spend by Category</span></div>
        ${Object.keys(cats).length===0?`<p style="color:var(--muted);text-align:center;padding:20px;font-size:13px;">No data.</p>`:Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>`
        <div class="chart-row"><div class="chart-label">${cat}</div><div class="chart-track"><div class="chart-fill" style="width:${(amt/maxC*100).toFixed(0)}%;background:${cColors[cat]||'#888'};"></div></div><div class="chart-val" style="color:${cColors[cat]||'#888'};">€${fmt(amt)}</div></div>`).join('')}
      </div>
      <div class="m-card"><div class="m-card-hdr"><span class="m-card-title">Approval Rate by Employee</span></div>
        ${Object.keys(empStats).length===0?`<p style="color:var(--muted);text-align:center;padding:20px;font-size:13px;">No data.</p>`:Object.entries(empStats).map(([name,s])=>{const r=Math.round(s.approved/s.total*100);return `<div class="chart-row"><div class="chart-label">${name.split(' ')[0]}</div><div class="chart-track"><div class="chart-fill" style="width:${r}%;background:${r>70?'var(--green)':r>40?'var(--amber)':'var(--red)'};"></div></div><div class="chart-val">${r}%</div></div>`;}).join('')}
      </div>
    </div>
    <div class="m-card"><div class="m-card-hdr"><span class="m-card-title">Monthly Expense Trend</span></div>
      ${Object.keys(months).length===0?`<p style="color:var(--muted);text-align:center;padding:20px;font-size:13px;">No data.</p>`:`
      <div style="display:flex;align-items:flex-end;gap:14px;height:130px;padding:0 8px;">
        ${Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).map(([m,v])=>`
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;">
          <div style="font-size:11px;color:var(--accent);font-weight:600;">€${Math.round(v)}</div>
          <div style="width:100%;background:linear-gradient(180deg,var(--accent2),var(--accent));border-radius:6px 6px 0 0;height:${(v/maxM*100).toFixed(0)}px;"></div>
          <div style="font-size:10px;color:var(--muted);">${m.slice(5)}</div>
        </div>`).join('')}
      </div>`}
    </div>`;
}

// ──────────────────────────────────────────
// MANAGER — SETTINGS
// ──────────────────────────────────────────
function renderMgrSettings() {
  document.getElementById('mgrMgrsettings').innerHTML=`
    <div class="m-card" style="max-width:520px;">
      <div class="m-card-hdr"><span class="m-card-title">Manager Settings</span></div>
      <div class="m-settings-group"><label class="m-settings-label">Manager Name</label><input id="mgrSettingName" class="m-settings-input" value="${currentUser?.name||''}"></div>
      <div class="m-settings-group"><label class="m-settings-label">Approval Threshold (€)</label><input id="mgrSettingThreshold" class="m-settings-input" type="number" value="${currentUser?.threshold||500}"><p style="font-size:12px;color:var(--muted);margin-top:6px;">Expenses above this are flagged as High Value.</p></div>
      <div class="m-settings-group"><label class="m-settings-label">Department</label><select id="mgrSettingDept" class="m-settings-input">${['Engineering','Marketing','Finance','Operations','HR','Sales'].map(d=>`<option>${d}</option>`).join('')}</select></div>
      <button class="btn-primary-sm" onclick="saveMgrSettings()"><i class="fas fa-save"></i> Save Settings</button>
    </div>`;
}
function saveMgrSettings() {
  if(!currentUser)return;
  currentUser.name=document.getElementById('mgrSettingName').value||currentUser.name;
  currentUser.threshold=parseFloat(document.getElementById('mgrSettingThreshold').value)||500;
  localStorage.setItem('expensio_user',JSON.stringify(currentUser));
  document.getElementById('mgrUserDisplay').textContent=currentUser.name;
  document.getElementById('mgrAva').textContent=initials(currentUser.name);
  showToast('Settings saved!','success');
}

// ──────────────────────────────────────────
// MANAGER — APPROVE / REJECT
// ──────────────────────────────────────────
async function quickApprove(id,prefix='') {
  const card=document.getElementById((prefix||'')+id);
  if(card)card.classList.add('approving');
  const data=await apiPatch('/expenses.php?id='+id+'&action=approve');
  if(data?.success){mgrUpdateBadge();renderMgrOverview();showToast('Expense approved ✓','success');}
  else showToast(data?.error||'Failed to approve','error');
}
function openRejectModal(id){pendingRejectId=id;document.getElementById('rejectReason').value='';openModal('rejectModal');}
async function confirmReject() {
  const reason=document.getElementById('rejectReason').value.trim();
  const data=await apiPatch('/expenses.php?id='+pendingRejectId+'&action=reject',{reason});
  if(data?.success){
    closeModal('rejectModal');pendingRejectId=null;mgrUpdateBadge();
    const ap=document.querySelector('.mgr-page.active');
    if(ap?.id==='mgrOverview')renderMgrOverview();
    if(ap?.id==='mgrPending')renderMgrPending();
    showToast('Expense rejected','error');
  } else showToast(data?.error||'Failed to reject','error');
}
function mgrViewReceipt(id,showActions) {
  const all=window._mgrExpenses||[];
  const exp=all.find(e=>e.id==id);
  if(!exp)return;
  showReceiptModal(exp.subject,`${exp.employee_name} · €${fmt(exp.amount)} · ${exp.expense_date}`,exp.receipt_data,showActions&&exp.status==='pending',showActions?id:null);
}
function showReceiptModal(title,sub,receiptData,showActions,expId) {
  document.getElementById('rvTitle').textContent=title;
  document.getElementById('rvSub').textContent=sub;
  const vc=document.getElementById('rvContent');
  if(receiptData){const isImg=receiptData.startsWith('data:image');vc.innerHTML=isImg?`<img src="${receiptData}" style="max-width:100%;max-height:420px;" />`:`<iframe src="${receiptData}" style="width:100%;height:400px;border:none;"></iframe>`;}
  else vc.innerHTML=`<div style="padding:40px;text-align:center;color:var(--muted);"><i class="fas fa-file-slash" style="font-size:36px;display:block;margin-bottom:12px;"></i>No receipt uploaded.</div>`;
  document.getElementById('rvActions').innerHTML=showActions&&expId
    ?`<button class="btn-approve" style="flex:1;" onclick="closeModal('receiptViewModal');quickApprove(${expId})"><i class="fas fa-check"></i> Approve</button><button class="btn-reject" style="flex:1;" onclick="closeModal('receiptViewModal');openRejectModal(${expId})"><i class="fas fa-times"></i> Reject</button>`
    :`<button class="btn-secondary" onclick="closeModal('receiptViewModal')">Close</button>`;
  openModal('receiptViewModal');
}
