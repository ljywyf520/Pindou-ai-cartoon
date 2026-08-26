import React, { useEffect, useMemo, useState } from 'react';
import {
  authenticateWithUsername,
  clearStoredSession,
  ensureUserProfile,
  fetchUserProfile,
  readStoredSession,
  saveStoredSession,
  decrementExportCount,
  decrementAiCount,
  redeemCode,
  isAdmin,
  ADMIN_KEY,
} from './zion';
import BeadConverter from './BeadConverter.jsx';
import ChibiGenerator from './ChibiGenerator.jsx';
import AdminPanel from './AdminPanel.jsx';

const emptyForm = {
  username: '',
  password: '',
};

function App() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(emptyForm);
  const [session, setSession] = useState(null);
  const [account, setAccount] = useState(null);
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState({
    kind: 'idle',
    text: '先登录，再进入拼豆图纸工作台。',
  });
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [activeTab, setActiveTab] = useState('workshop'); // workshop / chibi / redeem / account
  const [chibiResultImage, setChibiResultImage] = useState(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  const metrics = useMemo(
    () => [
      {
        label: '剩余导出',
        value: profile ? `${profile.remaining_export_count}` : '—',
      },
      {
        label: 'AI 生图',
        value: profile ? `${profile.remaining_ai_count}` : '—',
      },
      {
        label: '会员状态',
        value: profile ? membershipLabel(profile.membership_status) : '—',
      },
    ],
    [profile],
  );

  function membershipLabel(status) {
    switch (status) {
      case 'permanent':
        return '永久会员';
      case 'free':
      default:
        return '免费用户';
    }
  }

  function Icon({ label }) {
    return (
      <span className="icon" aria-hidden="true">
        {label}
      </span>
    );
  }

  useEffect(() => {
    const stored = readStoredSession();
    if (!stored?.token || !stored?.username) {
      setBooting(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        const currentProfile = await hydrateSession(stored.username, stored.token);
        if (!active) return;
        // 检查账号是否被禁用
        if (currentProfile && currentProfile.is_disabled) {
          clearStoredSession();
          setSession(null);
          setProfile(null);
          setStatus({
            kind: 'error',
            text: '该账号已被禁用，请联系管理员。',
          });
          return;
        }
        setSession(stored);
        setAccount(stored.account || null);
        setProfile(currentProfile);
        setStatus({
          kind: 'success',
          text: `已恢复登录：${stored.username}`,
        });
      } catch (error) {
        if (!active) return;
        clearStoredSession();
        setSession(null);
        setProfile(null);
        setStatus({
          kind: 'error',
          text: error instanceof Error ? error.message : '登录态已过期，请重新登录。',
        });
      } finally {
        if (active) setBooting(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function hydrateSession(username, token) {
    let currentProfile = await fetchUserProfile(username, token);
    if (!currentProfile) {
      currentProfile = await ensureUserProfile(username, token);
    }
    return currentProfile;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const username = form.username.trim();
    const password = form.password.trim();

    if (!username || !password) {
      setStatus({ kind: 'error', text: '请输入用户名和密码。' });
      return;
    }

    setBusy(true);
    setStatus({
      kind: 'idle',
      text: mode === 'login' ? '正在登录…' : '正在注册并创建账户…',
    });

    try {
      const result = await authenticateWithUsername({
        username,
        password,
        register: mode === 'register',
      });

      const token = result.authenticateWithUsername.jwt.token;
      const account = result.authenticateWithUsername.account;
      const currentUsername = account.username || username;
      const currentProfile = await hydrateSession(currentUsername, token);

      // 检查账号是否被禁用
      if (currentProfile && currentProfile.is_disabled) {
        throw new Error('该账号已被禁用，请联系管理员。');
      }

      const nextSession = { token, username: currentUsername, account };
      saveStoredSession(nextSession);
      setSession(nextSession);
      setAccount(account);
      setProfile(currentProfile);
      setForm(emptyForm);
      setStatus({
        kind: 'success',
        text: mode === 'register' ? '注册完成，账户已创建。' : '登录成功，已加载你的账户数据。',
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : '请求失败，请稍后重试。',
      });
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    clearStoredSession();
    setSession(null);
    setAccount(null);
    setProfile(null);
    setActiveTab('workshop');
    setStatus({
      kind: 'idle',
      text: '已退出登录。',
    });
  }

  async function handleExportUsed() {
    if (!session?.token || !profile?.id) return false;

    // 永久会员不扣次数
    if (profile.membership_status === 'permanent') return true;

    try {
      const updated = await decrementExportCount(profile.id, session.token);
      setProfile(updated);
      return true;
    } catch (error) {
      setStatus({ kind: 'error', text: error.message || '扣减次数失败，请稍后重试。' });
      return false;
    }
  }

  async function handleChibiUsed() {
    if (!session?.token || !profile?.id) return false;

    if (profile.remaining_ai_count <= 0) {
      setStatus({ kind: 'error', text: 'Q 版生成次数不足，请先兑换。' });
      return false;
    }

    try {
      const updated = await decrementAiCount(profile.id, session.token);
      setProfile(updated);
      return true;
    } catch (error) {
      setStatus({ kind: 'error', text: error.message || '扣减次数失败，请稍后重试。' });
      return false;
    }
  }

  function handleChibiToBeads(image) {
    setChibiResultImage(image);
    setActiveTab('workshop');
  }

  async function handleRedeem(code) {
    if (!session?.token || !profile?.id) {
      setStatus({ kind: 'error', text: '请先登录再兑换。' });
      return false;
    }

    try {
      const updated = await redeemCode(code.trim().toUpperCase(), profile.id, session.token);
      setProfile(updated);
      return true;
    } catch (error) {
      setStatus({ kind: 'error', text: error.message || '兑换失败，请检查兑换码是否正确。' });
      return false;
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <div>
            <div className="brand-title">豆格工坊</div>
            <div className="brand-subtitle">拼豆图纸转换器</div>
          </div>
        </div>
        <div className="topbar-meta">
          {session ? (
            <>
              <span className="badge badge-live">
                <Icon label="◉" />
                {session.username}
              </span>
              <button type="button" className="text-button" onClick={handleLogout}>
                退出
              </button>
            </>
          ) : (
            <span className="badge badge-muted">
              <Icon label="◌" />
              未登录
            </span>
          )}
        </div>
      </header>

      {/* 主导航标签 */}
      {session && (
        <nav className="main-nav">
          <button
            className={activeTab === 'workshop' ? 'nav-tab active' : 'nav-tab'}
            onClick={() => setActiveTab('workshop')}
          >
            🧩 图纸转换
          </button>
          <button
            className={activeTab === 'chibi' ? 'nav-tab active' : 'nav-tab'}
            onClick={() => setActiveTab('chibi')}
          >
            ✨ Q版生成
          </button>
          <button
            className={activeTab === 'redeem' ? 'nav-tab active' : 'nav-tab'}
            onClick={() => setActiveTab('redeem')}
          >
            🎁 兑换码
          </button>
          <button
            className={activeTab === 'account' ? 'nav-tab active' : 'nav-tab'}
            onClick={() => setActiveTab('account')}
          >
            👤 我的账户
          </button>
          {isAdmin(account) && (
            <button
              className={activeTab === 'admin' ? 'nav-tab active' : 'nav-tab'}
              onClick={() => setActiveTab('admin')}
            >
              ⚙️ 管理后台
            </button>
          )}
        </nav>
      )}

      <main className="shell">
        {!session ? (
          <AuthView
            mode={mode}
            setMode={setMode}
            form={form}
            setForm={setForm}
            onSubmit={handleSubmit}
            status={status}
            busy={busy || booting}
          />
        ) : activeTab === 'workshop' ? (
          <BeadConverter
            userProfile={profile}
            session={session}
            onExportUsed={handleExportUsed}
            presetImage={chibiResultImage}
          />
        ) : activeTab === 'chibi' ? (
          <ChibiGenerator
            userProfile={profile}
            session={session}
            onChibiUsed={handleChibiUsed}
            onConvertToBeads={handleChibiToBeads}
          />
        ) : activeTab === 'redeem' ? (
          <RedeemView onRedeem={handleRedeem} profile={profile} />
        ) : activeTab === 'admin' && isAdmin(account) ? (
          adminUnlocked ? (
            <AdminPanel session={session} />
          ) : (
            <AdminLockView onUnlock={(key) => {
              if (key === ADMIN_KEY) {
                setAdminUnlocked(true);
                setStatus({ kind: 'success', text: '管理员验证成功。' });
              } else {
                setStatus({ kind: 'error', text: '密钥不正确。' });
              }
            }} status={status} />
          )
        ) : (
          <AccountView profile={profile} metrics={metrics} />
        )}
      </main>
    </div>
  );
}

function AuthView({ mode, setMode, form, setForm, onSubmit, status, busy }) {
  return (
    <div className="auth-layout">
      <section className="hero">
        <p className="eyebrow">豆格工坊</p>
        <h1>把照片变成拼豆图纸</h1>
        <p className="hero-copy">
          上传照片，一键生成可直接制作的拼豆图纸。支持自定义尺寸、5×5 分块、色号标注。
        </p>
        <div className="hero-grid">
          <article>
            <span>图纸转换</span>
            <strong>智能配色</strong>
          </article>
          <article>
            <span>AI 转卡通</span>
            <strong>Q 版人物</strong>
          </article>
          <article>
            <span>导出无水印</span>
            <strong>高清 PNG</strong>
          </article>
        </div>
      </section>

      <article className="panel auth-panel">
        <div className="tabs" role="tablist" aria-label="登录方式">
          <button
            type="button"
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => setMode('login')}
          >
            <Icon label="↪" />
            登录
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => setMode('register')}
          >
            <Icon label="＋" />
            注册
          </button>
        </div>

        <div className={`notice ${status.kind}`}>
          {busy ? <span className="spin">◌</span> : <Icon label="✦" />}
          <span>{status.text}</span>
        </div>

        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            <span>用户名</span>
            <input
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              placeholder="例如: lily2026"
              autoComplete="username"
            />
          </label>
          <label className="field">
            <span>密码</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="至少 6 位更稳妥"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          <button className="primary-button" type="submit" disabled={busy}>
            {mode === 'login' ? (
              <>
                <Icon label="↪" />
                <span>登录</span>
              </>
            ) : (
              <>
                <Icon label="＋" />
                <span>注册并开通账户</span>
              </>
            )}
          </button>
        </form>

        <p className="auth-note">
          注册后可免费预览图纸（带水印），购买导出次数后可下载无水印高清图。
        </p>
      </article>
    </div>
  );
}

function AccountView({ profile, metrics }) {
  return (
    <div className="account-view">
      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">我的账户</p>
            <h2>{profile?.username}</h2>
          </div>
          <span className="status-pill status-good">
            <Icon label="◌" />
            已连接
          </span>
        </div>

        <div className="metric-grid">
          {metrics.map((item) => (
            <article key={item.label} className="metric">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>

        <div className="panel-note">
          <Icon label="✓" />
          账户 ID：{profile?.id ?? '读取中'}
        </div>
      </article>
    </div>
  );
}

function RedeemView({ onRedeem, profile }) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setMessage({ kind: 'error', text: '请输入兑换码。' });
      return;
    }

    setBusy(true);
    setMessage(null);
    const success = await onRedeem(code);
    if (success) {
      setMessage({ kind: 'success', text: '兑换成功！权益已到账。' });
      setCode('');
    }
    setBusy(false);
  };

  return (
    <div className="redeem-view">
      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">兑换中心</p>
            <h2>输入兑换码激活权益</h2>
          </div>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>兑换码</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="PIDOU-XXXX-XXXX-XXXX"
              style={{ letterSpacing: '2px', fontFamily: 'monospace' }}
            />
          </label>

          {message && (
            <div className={`notice ${message.kind}`}>
              <Icon label={message.kind === 'success' ? '✓' : '✕'} />
              <span>{message.text}</span>
            </div>
          )}

          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? (
              <>
                <span className="spin">◌</span>
                <span>兑换中…</span>
              </>
            ) : (
              <>
                <Icon label="🎁" />
                <span>立即兑换</span>
              </>
            )}
          </button>
        </form>

        <div className="panel-note" style={{ marginTop: '16px' }}>
          <Icon label="ℹ" />
          当前剩余：导出 {profile?.remaining_export_count ?? 0} 次 / AI 生图 {profile?.remaining_ai_count ?? 0} 次
        </div>
      </article>
    </div>
  );
}

function Icon({ label }) {
  return (
    <span className="icon" aria-hidden="true">
      {label}
    </span>
  );
}

function AdminLockView({ onUnlock, status }) {
  const [key, setKey] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onUnlock(key.trim());
  };

  return (
    <div className="redeem-view">
      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">管理后台</p>
            <h2>请输入管理员密钥</h2>
          </div>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>管理员密钥</span>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="请输入密钥"
              style={{ fontFamily: 'monospace', letterSpacing: '2px' }}
              autoFocus
            />
          </label>

          {status?.kind === 'error' && (
            <div className="notice error">
              <Icon label="✕" />
              <span>{status.text}</span>
            </div>
          )}

          <button className="primary-button" type="submit">
            <Icon label="🔒" />
            <span>验证进入</span>
          </button>
        </form>
      </article>
    </div>
  );
}

export default App;
