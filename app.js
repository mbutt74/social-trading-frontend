const API = 'https://social-trading-platform-production.up.railway.app';

let currentTraderId = null;

// ---- Auth helpers ----
function getUser() { try { return JSON.parse(localStorage.getItem('ct_user')); } catch { return null; } }
function setUser(u) { localStorage.setItem('ct_user', JSON.stringify(u)); }
function logout() { localStorage.removeItem('ct_user'); location.reload(); }

// ---- Modal helpers ----
function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }
function switchModal(hide, show) { hideModal(hide); showModal(show); }
function showMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'msg ' + type;
}

// ---- Update navbar with logged-in user ----
function updateNavUser() {
  const user = getUser();
  const navAction = document.getElementById('nav-action');
  const navUser = document.getElementById('nav-user');
  if (user) {
    if (navAction) {
      navAction.textContent = 'Dashboard';
      navAction.onclick = (e) => { e.preventDefault(); openDashboard(); };
    }
    if (navUser) navUser.textContent = '👤 ' + user.username;
  } else {
    if (navAction) {
      navAction.textContent = 'Login';
      navAction.onclick = (e) => { e.preventDefault(); showModal('login-modal'); };
    }
  }
}

// ---- Open dashboard ----
async function openDashboard() {
  const user = getUser();
  if (!user) return showModal('login-modal');

  document.getElementById('dash-username').textContent = '👤 ' + user.username;

  // Load latest accounts from server
  try {
    const res = await fetch(`${API}/trader/accounts/${user.id}`);
    const data = await res.json();
    const accounts = data.accounts || [];

    const container = document.getElementById('dash-accounts');
    if (accounts.length === 0) {
      container.innerHTML = '<p style="color:var(--text2);font-size:13px;text-align:center">No MT accounts connected yet.</p>';
    } else {
      container.innerHTML = accounts.map(a => `
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong style="font-size:14px">${a.label || a.mt_login}</strong>
            <span style="font-size:11px;background:var(--bg2);padding:2px 8px;border-radius:4px;color:var(--text2)">${(a.mt_platform||'mt5').toUpperCase()}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
            <div>
              <div style="font-size:10px;color:var(--text2)">Balance</div>
              <div style="font-size:14px;font-weight:700">${a.currency || 'USD'} ${parseFloat(a.account_balance||0).toFixed(2)}</div>
            </div>
            <div>
              <div style="font-size:10px;color:var(--text2)">Profit</div>
              <div style="font-size:14px;font-weight:700;color:${(a.profit_percent||0)>=0?'var(--green)':'var(--red)'}">
                ${(a.profit_percent||0)>=0?'+':''}${parseFloat(a.profit_percent||0).toFixed(2)}%
              </div>
            </div>
            <div>
              <div style="font-size:10px;color:var(--text2)">Win Rate</div>
              <div style="font-size:14px;font-weight:700">${a.win_rate||0}%</div>
            </div>
          </div>
          <div style="font-size:11px;color:var(--text2);margin-bottom:10px">${a.broker||a.mt_server} · Login: ${a.mt_login}</div>
          <button onclick="removeAccount('${a.id}')" style="font-size:11px;background:none;border:1px solid var(--border);color:var(--text2);padding:4px 10px;border-radius:4px;cursor:pointer">Remove account</button>
        </div>
      `).join('');
    }
  } catch (e) {
    document.getElementById('dash-accounts').innerHTML = '<p style="color:var(--text2);font-size:13px">Could not load accounts.</p>';
  }

  showModal('dashboard-modal');
}

// ---- Remove an MT account ----
async function removeAccount(accountId) {
  if (!confirm('Are you sure you want to remove this MT account?')) return;
  try {
    const res = await fetch(`${API}/trader/account/${accountId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      openDashboard();
    } else {
      alert(data.error || 'Could not remove account');
    }
  } catch (e) {
    alert('Connection error: ' + e.message);
  }
}

// ---- Step 1: Create basic profile ----
async function registerStep1() {
  const usernameEl = document.getElementById('reg-username');
  const emailEl = document.getElementById('reg-email');
  const username = (usernameEl?.value || usernameEl?.innerText || '').trim();
  const email = (emailEl?.value || emailEl?.innerText || '').trim();

  if (!username || !email) {
    showMsg('reg-msg1', 'Please click into each field and retype if needed', 'error');
    return;
  }

  showMsg('reg-msg1', 'Creating your profile...', 'success');

  try {
    const res = await fetch(`${API}/trader/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email })
    });
    const data = await res.json();
    if (data.success) {
      currentTraderId = data.trader.id;
      setUser(data.trader);
      // Move to step 2
      document.getElementById('reg-step1').style.display = 'none';
      document.getElementById('reg-step2').style.display = 'block';
      showMsg('reg-msg2', '', '');
    } else {
      showMsg('reg-msg1', data.error || 'Registration failed', 'error');
    }
  } catch (e) {
    showMsg('reg-msg1', 'Cannot reach server: ' + e.message, 'error');
  }
}

// ---- Step 2: Connect MT account during registration ----
async function registerStep2() {
  const traderId = currentTraderId || getUser()?.id;
  if (!traderId) return showMsg('reg-msg2', 'Session expired. Please refresh and try again.', 'error');

  const label = document.getElementById('reg-label')?.value.trim();
  const mtLogin = document.getElementById('reg-mtlogin')?.value.trim();
  const mtPassword = document.getElementById('reg-mtpassword')?.value.trim();
  const mtServer = document.getElementById('reg-mtserver')?.value.trim();
  const mtPlatform = document.getElementById('reg-platform')?.value;
  const isLeader = document.getElementById('reg-leader')?.checked;

  if (!mtLogin || !mtPassword || !mtServer) {
    return showMsg('reg-msg2', 'Please fill in your MT account number, password and server', 'error');
  }

  showMsg('reg-msg2', '⏳ Connecting to your MT account... please wait up to 60 seconds', 'success');

  try {
    const res = await fetch(`${API}/trader/add-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traderId, label, mtLogin, mtPassword, mtServer, mtPlatform, isLeader })
    });

    let data;
    try { data = await res.json(); } catch(e) {
      return showMsg('reg-msg2', 'Server error (status ' + res.status + ')', 'error');
    }

    if (data.success) {
      const user = getUser() || {};
      user.accounts = user.accounts || [];
      user.accounts.push(data.account);
      setUser(user);
      showMsg('reg-msg2', `✅ Connected! ${data.account.label} — Balance: ${data.account.currency} ${parseFloat(data.account.balance||0).toFixed(2)}`, 'success');
      setTimeout(() => {
        hideModal('register-modal');
        updateNavUser();
        loadHomeLeaderboard();
        loadStats();
      }, 2500);
    } else {
      showMsg('reg-msg2', data.error || 'Connection failed', 'error');
    }
  } catch (e) {
    showMsg('reg-msg2', 'Cannot reach server: ' + e.message, 'error');
  }
}

// ---- Add another MT account (from dashboard) ----
async function addAccount() {
  const user = getUser();
  if (!user) return showModal('login-modal');

  const label = document.getElementById('add-label')?.value.trim();
  const mtLogin = document.getElementById('add-mtlogin')?.value.trim();
  const mtPassword = document.getElementById('add-mtpassword')?.value.trim();
  const mtServer = document.getElementById('add-mtserver')?.value.trim();
  const mtPlatform = document.getElementById('add-platform')?.value;
  const isLeader = document.getElementById('add-leader')?.checked;

  if (!mtLogin || !mtPassword || !mtServer) {
    return showMsg('add-msg', 'Please fill in all MT account fields', 'error');
  }

  showMsg('add-msg', '⏳ Connecting to your MT account... please wait up to 60 seconds', 'success');

  try {
    const res = await fetch(`${API}/trader/add-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traderId: user.id, label, mtLogin, mtPassword, mtServer, mtPlatform, isLeader })
    });

    let data;
    try { data = await res.json(); } catch(e) {
      return showMsg('add-msg', 'Server error (status ' + res.status + ')', 'error');
    }

    if (data.success) {
      showMsg('add-msg', `✅ Connected! ${data.account.label} — Balance: ${data.account.currency} ${parseFloat(data.account.balance||0).toFixed(2)}`, 'success');
      setTimeout(() => {
        hideModal('add-account-modal');
        openDashboard();
      }, 2000);
    } else {
      showMsg('add-msg', data.error || 'Connection failed', 'error');
    }
  } catch (e) {
    showMsg('add-msg', 'Cannot reach server: ' + e.message, 'error');
  }
}

// ---- Login ----
async function login() {
  const email = document.getElementById('login-email')?.value.trim();
  if (!email) return showMsg('login-msg', 'Please enter your email', 'error');
  showMsg('login-msg', 'Logging in...', 'success');
  try {
    const res = await fetch(`${API}/trader/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (data.success) {
      setUser(data.trader);
      showMsg('login-msg', 'Welcome back ' + data.trader.username + '!', 'success');
      setTimeout(() => {
        hideModal('login-modal');
        updateNavUser();
      }, 1500);
    } else {
      showMsg('login-msg', data.error || 'Account not found', 'error');
    }
  } catch (e) {
    showMsg('login-msg', 'Cannot reach server: ' + e.message, 'error');
  }
}

// ---- Trader card HTML ----
function traderCard(t) {
  const profit = parseFloat(t.profit_percent || 0);
  const profitClass = profit >= 0 ? 'positive' : 'negative';
  const profitSign = profit >= 0 ? '+' : '';
  return `
    <div class="trader-card">
      <div class="trader-card-header">
        <div class="trader-name">👤 ${t.username}</div>
        ${t.is_leader ? '<span class="trader-badge">LEADER</span>' : ''}
      </div>
      ${t.broker ? `<div style="font-size:11px;color:var(--text2);margin-bottom:12px">${t.broker} · ${(t.mt_platform||'').toUpperCase()}</div>` : ''}
      <div class="trader-stats">
        <div>
          <div class="trader-stat-label">Profit</div>
          <div class="trader-stat-value ${profitClass}">${profitSign}${profit.toFixed(2)}%</div>
        </div>
        <div>
          <div class="trader-stat-label">Win Rate</div>
          <div class="trader-stat-value">${t.win_rate || 0}%</div>
        </div>
        <div>
          <div class="trader-stat-label">Trades</div>
          <div class="trader-stat-value">${t.total_trades || 0}</div>
        </div>
        <div>
          <div class="trader-stat-label">Followers</div>
          <div class="trader-stat-value">${t.followers_count || 0}</div>
        </div>
      </div>
      <button class="btn-follow btn-sm" onclick="followTrader('${t.id}','${t.best_account_id||''}')">Copy Trader</button>
    </div>`;
}

// ---- Load home leaderboard (top 3) ----
async function loadHomeLeaderboard() {
  try {
    const res = await fetch(`${API}/leaderboard`);
    const data = await res.json();
    const el = document.getElementById('home-leaderboard');
    if (!el) return;
    if (!data.leaderboard || data.leaderboard.length === 0) {
      el.innerHTML = '<p class="loading">No traders yet — be the first to register!</p>';
      return;
    }
    el.innerHTML = data.leaderboard.slice(0, 3).map(t => traderCard(t)).join('');
  } catch (e) {
    const el = document.getElementById('home-leaderboard');
    if (el) el.innerHTML = '<p class="loading">Could not load traders.</p>';
  }
}

// ---- Load stats ----
async function loadStats() {
  try {
    const res = await fetch(`${API}/leaderboard`);
    const data = await res.json();
    const count = data.leaderboard?.length || 0;
    const trades = data.leaderboard?.reduce((s, t) => s + (t.total_trades || 0), 0) || 0;
    const el1 = document.getElementById('stat-traders');
    const el2 = document.getElementById('stat-trades');
    if (el1) el1.textContent = count;
    if (el2) el2.textContent = trades;
  } catch (e) {}
}

// ---- Load full leaderboard table ----
async function loadLeaderboard() {
  try {
    const res = await fetch(`${API}/leaderboard`);
    const data = await res.json();
    const tbody = document.getElementById('leaderboard-body');
    if (!tbody) return;
    if (!data.leaderboard || data.leaderboard.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading">No traders yet. Register to be first on the board!</td></tr>';
      return;
    }
    tbody.innerHTML = data.leaderboard.map((t, i) => {
      const profit = parseFloat(t.profit_percent || 0);
      const profitClass = profit >= 0 ? 'positive' : 'negative';
      const profitSign = profit >= 0 ? '+' : '';
      const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);
      const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
      return `<tr>
        <td><span class="rank-num ${rankClass}">${rankIcon}</span></td>
        <td>
          <strong>${t.username}</strong>
          ${t.is_leader ? ' <span class="trader-badge">LEADER</span>' : ''}
          ${t.broker ? `<div style="font-size:11px;color:var(--text2)">${t.broker} · ${(t.mt_platform||'').toUpperCase()}</div>` : ''}
        </td>
        <td class="${profitClass}">${profitSign}${profit.toFixed(2)}%</td>
        <td>${t.win_rate || 0}%</td>
        <td>${t.total_trades || 0}</td>
        <td>${t.followers_count || 0}</td>
        <td><button class="btn-follow" onclick="followTrader('${t.id}','${t.best_account_id||''}')">Copy</button></td>
      </tr>`;
    }).join('');
  } catch (e) {
    const tbody = document.getElementById('leaderboard-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="loading">Could not load leaderboard.</td></tr>';
  }
}

// ---- Follow a trader ----
async function followTrader(leaderId, mtAccountId) {
  const user = getUser();
  if (!user) { showModal('login-modal'); return; }
  if (!mtAccountId || mtAccountId === 'undefined') {
    return alert('This trader has no active MT account to copy yet.');
  }
  try {
    const res = await fetch(`${API}/follow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followerId: user.id, leaderId, mtAccountId })
    });
    const data = await res.json();
    if (data.success) {
      alert('✅ You are now copying this trader! Trades will be mirrored automatically.');
      loadLeaderboard();
      loadHomeLeaderboard();
    } else {
      alert(data.error || 'Could not follow trader');
    }
  } catch (e) {
    alert('Connection error: ' + e.message);
  }
}

// ---- Filter leaderboard ----
function filterLeaderboard(type, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadLeaderboard();
}
