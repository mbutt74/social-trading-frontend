// ---- IMPORTANT: paste your Railway URL here ----
const API = 'https://social-trading-platform-production.up.railway.app/';

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

// ---- Register ----
async function register() {
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const apiKey = document.getElementById('reg-apikey').value.trim();
  const capitalLogin = document.getElementById('reg-login').value.trim();
  const capitalPassword = document.getElementById('reg-password').value.trim();
  const isLeader = document.getElementById('reg-leader').checked;

  if (!username || !email || !apiKey || !capitalLogin || !capitalPassword) {
    return showMsg('reg-msg', 'Please fill in all fields', 'error');
  }

  try {
    const res = await fetch(`${API}/trader/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, apiKey, capitalLogin, capitalPassword, isLeader })
    });
    const data = await res.json();
    if (data.success) {
      setUser(data.trader);
      showMsg('reg-msg', 'Account created! Welcome ' + username, 'success');
      setTimeout(() => { hideModal('register-modal'); location.reload(); }, 1500);
    } else {
      showMsg('reg-msg', data.error || 'Registration failed', 'error');
    }
  } catch (e) {
    showMsg('reg-msg', 'Connection error. Check your internet.', 'error');
  }
}

// ---- Login (simple email lookup) ----
async function login() {
  const email = document.getElementById('login-email').value.trim();
  if (!email) return showMsg('login-msg', 'Enter your email', 'error');
  try {
    const res = await fetch(`${API}/trader/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (data.success) {
      setUser(data.trader);
      showMsg('login-msg', 'Welcome back ' + data.trader.username, 'success');
      setTimeout(() => { hideModal('login-modal'); location.reload(); }, 1500);
    } else {
      showMsg('login-msg', 'Account not found', 'error');
    }
  } catch (e) {
    showMsg('login-msg', 'Connection error', 'error');
  }
}

// ---- Update nav with logged-in user ----
function updateNavUser() {
  const user = getUser();
  const navAction = document.getElementById('nav-action');
  const navUser = document.getElementById('nav-user');
  if (user && navAction) {
    navAction.textContent = 'Logout';
    navAction.onclick = logout;
    if (navUser) navUser.textContent = '👤 ' + user.username;
  }
}

// ---- Load home leaderboard (top 3 cards) ----
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
    const count = data.leaderboard ? data.leaderboard.length : 0;
    const trades = data.leaderboard ? data.leaderboard.reduce((s, t) => s + (t.total_trades || 0), 0) : 0;
    const el1 = document.getElementById('stat-traders');
    const el2 = document.getElementById('stat-trades');
    if (el1) el1.textContent = count;
    if (el2) el2.textContent = trades;
  } catch (e) {}
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
      <button class="btn-follow btn-sm" onclick="followTrader('${t.id}')">Copy Trader</button>
    </div>`;
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
      const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
      return `<tr>
        <td><span class="rank-num ${rankClass}">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i+1)}</span></td>
        <td><strong>${t.username}</strong>${t.is_leader ? ' <span class="trader-badge">LEADER</span>' : ''}</td>
        <td class="${profitClass}">${profitSign}${profit.toFixed(2)}%</td>
        <td>${t.win_rate || 0}%</td>
        <td>${t.total_trades || 0}</td>
        <td>${t.followers_count || 0}</td>
        <td><button class="btn-follow" onclick="followTrader('${t.id}')">Copy</button></td>
      </tr>`;
    }).join('');
  } catch (e) {
    const tbody = document.getElementById('leaderboard-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="loading">Could not load leaderboard.</td></tr>';
  }
}

// ---- Follow a trader ----
async function followTrader(leaderId) {
  const user = getUser();
  if (!user) { showModal('login-modal'); return; }
  try {
    const res = await fetch(`${API}/follow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followerId: user.id, leaderId })
    });
    const data = await res.json();
    if (data.success) {
      alert('You are now copying this trader!');
      loadLeaderboard();
    } else {
      alert(data.error || 'Could not follow trader');
    }
  } catch (e) {
    alert('Connection error');
  }
}

// ---- Filter leaderboard ----
function filterLeaderboard(type, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadLeaderboard();
}
