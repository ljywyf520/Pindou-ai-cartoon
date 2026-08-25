import React, { useState, useEffect } from 'react';
import { adminListUsers, adminListRedeemCodes, adminCreateRedeemCode } from './zion.js';

export default function AdminPanel({ session }) {
  const [activeSection, setActiveSection] = useState('redeem'); // redeem / users
  const [users, setUsers] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [codes, setCodes] = useState([]);
  const [codeTotal, setCodeTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // 创建兑换码表单
  const [newCode, setNewCode] = useState('');
  const [codeType, setCodeType] = useState('normal');
  const [exportCount, setExportCount] = useState(10);
  const [aiCount, setAiCount] = useState(3);
  const [createMsg, setCreateMsg] = useState(null);
  const [creating, setCreating] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await adminListUsers(session.token, 50, 0);
      setUsers(res.users);
      setUserTotal(res.total);
    } catch (e) {
      console.error('加载用户列表失败', e);
    } finally {
      setLoading(false);
    }
  };

  const loadCodes = async () => {
    setLoading(true);
    try {
      const res = await adminListRedeemCodes(session.token, 50, 0);
      setCodes(res.codes);
      setCodeTotal(res.total);
    } catch (e) {
      console.error('加载兑换码列表失败', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'users') {
      loadUsers();
    } else {
      loadCodes();
    }
  }, [activeSection]);

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'PIDOU-';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    code += '-';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    code += '-';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setNewCode(code);
  };

  const handleCreateCode = async (e) => {
    e.preventDefault();
    if (!newCode.trim()) {
      setCreateMsg({ kind: 'error', text: '请输入或生成兑换码' });
      return;
    }
    setCreating(true);
    setCreateMsg(null);
    try {
      await adminCreateRedeemCode(session.token, {
        code: newCode.trim(),
        type: codeType,
        exportCount: parseInt(exportCount) || 0,
        aiCount: parseInt(aiCount) || 0,
      });
      setCreateMsg({ kind: 'success', text: '兑换码创建成功！' });
      setNewCode('');
      loadCodes(); // 刷新列表
    } catch (err) {
      setCreateMsg({ kind: 'error', text: err.message || '创建失败' });
    } finally {
      setCreating(false);
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      // 简单提示
    });
  };

  return (
    <div className="admin-panel">
      <div className="admin-sidebar">
        <div className="section-title">管理后台</div>
        <button
          className={activeSection === 'redeem' ? 'admin-nav-item active' : 'admin-nav-item'}
          onClick={() => setActiveSection('redeem')}
        >
          🎁 兑换码管理
        </button>
        <button
          className={activeSection === 'users' ? 'admin-nav-item active' : 'admin-nav-item'}
          onClick={() => setActiveSection('users')}
        >
          👥 用户列表
        </button>
      </div>

      <div className="admin-content">
        {activeSection === 'redeem' && (
          <div className="admin-section">
            <div className="panel">
              <div className="panel-head">
                <div>
                  <p className="panel-kicker">创建兑换码</p>
                  <h2>生成新的兑换码</h2>
                </div>
              </div>

              <form className="form" onSubmit={handleCreateCode}>
                <div className="admin-form-row">
                  <label>兑换码</label>
                  <div className="code-input-wrap">
                    <input
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                      placeholder="PIDOU-XXXX-XXXX-XXXX"
                      style={{ letterSpacing: '2px', fontFamily: 'monospace' }}
                    />
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={generateRandomCode}
                    >
                      随机生成
                    </button>
                  </div>
                </div>

                <div className="admin-form-row">
                  <label>类型</label>
                  <select
                    value={codeType}
                    onChange={(e) => setCodeType(e.target.value)}
                    className="select-input"
                  >
                    <option value="normal">普通次数码</option>
                    <option value="permanent">永久会员码</option>
                  </select>
                </div>

                <div className="admin-form-grid">
                  <div className="admin-form-row">
                    <label>导出次数</label>
                    <input
                      type="number"
                      min="0"
                      value={exportCount}
                      onChange={(e) => setExportCount(e.target.value)}
                    />
                  </div>
                  <div className="admin-form-row">
                    <label>AI 生图次数</label>
                    <input
                      type="number"
                      min="0"
                      value={aiCount}
                      onChange={(e) => setAiCount(e.target.value)}
                    />
                  </div>
                </div>

                {createMsg && (
                  <div className={`notice ${createMsg.kind}`}>
                    <span>{createMsg.kind === 'success' ? '✓' : '✕'}</span>
                    <span>{createMsg.text}</span>
                  </div>
                )}

                <button type="submit" className="primary-button" disabled={creating}>
                  {creating ? (
                    <>
                      <span className="spin">◌</span>
                      <span>创建中…</span>
                    </>
                  ) : (
                    <>
                      <span>＋</span>
                      <span>创建兑换码</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="panel" style={{ marginTop: '16px' }}>
              <div className="panel-head">
                <div>
                  <p className="panel-kicker">兑换码列表</p>
                  <h2>共 {codeTotal} 个兑换码</h2>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={loadCodes}
                  disabled={loading}
                >
                  刷新
                </button>
              </div>

              {loading && <div className="admin-loading">加载中…</div>}

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>兑换码</th>
                      <th>类型</th>
                      <th>导出</th>
                      <th>AI</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((c) => (
                      <tr key={c.id}>
                        <td className="code-cell">{c.code}</td>
                        <td>{c.type === 'permanent' ? '永久会员' : '普通'}</td>
                        <td>{c.export_count}</td>
                        <td>{c.ai_count}</td>
                        <td>
                          <span className={`status-tag ${c.status}`}>
                            {c.status === 'active' ? '未使用' : '已使用'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => copyCode(c.code)}
                          >
                            复制
                          </button>
                        </td>
                      </tr>
                    ))}
                    {codes.length === 0 && !loading && (
                      <tr>
                        <td colSpan="6" className="empty-row">暂无兑换码</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'users' && (
          <div className="admin-section">
            <div className="panel">
              <div className="panel-head">
                <div>
                  <p className="panel-kicker">用户列表</p>
                  <h2>共 {userTotal} 位用户</h2>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={loadUsers}
                  disabled={loading}
                >
                  刷新
                </button>
              </div>

              {loading && <div className="admin-loading">加载中…</div>}

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>用户名</th>
                      <th>会员状态</th>
                      <th>剩余导出</th>
                      <th>剩余 AI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="username-cell">{u.username}</td>
                        <td>
                          <span className={`status-tag ${u.membership_status}`}>
                            {u.membership_status === 'permanent' ? '永久会员' : '免费用户'}
                          </span>
                        </td>
                        <td>{u.remaining_export_count}</td>
                        <td>{u.remaining_ai_count}</td>
                      </tr>
                    ))}
                    {users.length === 0 && !loading && (
                      <tr>
                        <td colSpan="4" className="empty-row">暂无用户</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
