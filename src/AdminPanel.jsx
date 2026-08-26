import React, { useState, useEffect } from 'react';
import {
  adminListUsers,
  adminListRedeemCodes,
  adminCreateRedeemCode,
  adminUpdateUserCounts,
  adminSetMembership,
  adminSetDisabled,
  adminResetPassword,
  adminBatchCreateRedeemCodes,
  adminUpdateRedeemCode,
  adminDeleteRedeemCode,
  adminSearchRedeemCodes,
} from './zion.js';

export default function AdminPanel({ session }) {
  const [activeSection, setActiveSection] = useState('redeem');
  const [users, setUsers] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [codes, setCodes] = useState([]);
  const [codeTotal, setCodeTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // 兑换码表单
  const [newCode, setNewCode] = useState('');
  const [codeType, setCodeType] = useState('normal');
  const [exportCount, setExportCount] = useState(10);
  const [aiCount, setAiCount] = useState(3);
  const [createMsg, setCreateMsg] = useState(null);
  const [creating, setCreating] = useState(false);

  // 搜索筛选
  const [searchKeyword, setSearchKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // 批量生成
  const [batchCount, setBatchCount] = useState(10);
  const [batchType, setBatchType] = useState('normal');
  const [batchExport, setBatchExport] = useState(10);
  const [batchAi, setBatchAi] = useState(3);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchResult, setBatchResult] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // 编辑兑换码
  const [editCode, setEditCode] = useState(null);
  const [editType, setEditType] = useState('normal');
  const [editExport, setEditExport] = useState(0);
  const [editAi, setEditAi] = useState(0);
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg] = useState(null);

  // 用户操作弹窗
  const [actionModal, setActionModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  // 调整次数表单
  const [adjExport, setAdjExport] = useState(0);
  const [adjAi, setAdjAi] = useState(0);

  // 重置密码表单
  const [newPassword, setNewPassword] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await adminListUsers(session.token, 50, 0);
      setUsers(res.users);
      setUserTotal(res.total);
    } catch (e) {
      console.error('加载用户列表失败', e);
      setLoadError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCodes = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (searchKeyword || typeFilter !== 'all' || statusFilter !== 'all') {
        const res = await adminSearchRedeemCodes(session.token, {
          keyword: searchKeyword,
          typeFilter,
          statusFilter,
        });
        setCodes(res.codes);
        setCodeTotal(res.total);
      } else {
        const res = await adminListRedeemCodes(session.token, 50, 0);
        setCodes(res.codes);
        setCodeTotal(res.total);
      }
    } catch (e) {
      console.error('加载兑换码列表失败', e);
      setLoadError(e.message || '加载失败');
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
      loadCodes();
    } catch (err) {
      setCreateMsg({ kind: 'error', text: err.message || '创建失败' });
    } finally {
      setCreating(false);
    }
  };

  const handleBatchCreate = async () => {
    if (batchCount < 1 || batchCount > 100) {
      return;
    }
    setBatchLoading(true);
    setBatchResult([]);
    try {
      const result = await adminBatchCreateRedeemCodes(session.token, {
        count: parseInt(batchCount),
        type: batchType,
        exportCount: parseInt(batchExport) || 0,
        aiCount: parseInt(batchAi) || 0,
      });
      setBatchResult(result);
      loadCodes();
    } catch (err) {
      alert(err.message || '批量生成失败');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadCodes();
  };

  const openEditModal = (code) => {
    setEditCode(code);
    setEditType(code.type);
    setEditExport(parseInt(code.export_count) || 0);
    setEditAi(parseInt(code.ai_count) || 0);
    setEditMsg(null);
  };

  const handleUpdateCode = async () => {
    if (!editCode) return;
    setEditLoading(true);
    setEditMsg(null);
    try {
      await adminUpdateRedeemCode(session.token, {
        id: editCode.id,
        type: editType,
        exportCount: parseInt(editExport) || 0,
        aiCount: parseInt(editAi) || 0,
      });
      setEditMsg({ kind: 'success', text: '更新成功！' });
      loadCodes();
    } catch (err) {
      setEditMsg({ kind: 'error', text: err.message || '更新失败' });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteCode = async (code) => {
    if (!confirm(`确定要删除兑换码 ${code.code} 吗？`)) return;
    try {
      await adminDeleteRedeemCode(session.token, code.id);
      loadCodes();
    } catch (err) {
      alert(err.message || '删除失败');
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
  };

  const copyAllBatchCodes = () => {
    const all = batchResult.map(c => c.code).join('\n');
    navigator.clipboard.writeText(all);
    alert('已复制到剪贴板');
  };

  const openModal = (type, user) => {
    setActionModal({ type, user });
    setActionMsg(null);
    if (type === 'counts') {
      setAdjExport(0);
      setAdjAi(0);
    }
    if (type === 'password') {
      setNewPassword('');
    }
  };

  const closeModal = () => {
    setActionModal(null);
    setActionMsg(null);
  };

  const handleUpdateCounts = async () => {
    if (!actionModal?.user) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      await adminUpdateUserCounts(
        session.token,
        actionModal.user.id,
        parseInt(adjExport) || 0,
        parseInt(adjAi) || 0
      );
      setActionMsg({ kind: 'success', text: '次数调整成功！' });
      loadUsers();
    } catch (err) {
      setActionMsg({ kind: 'error', text: err.message || '调整失败' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetMembership = async (status) => {
    if (!actionModal?.user) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      await adminSetMembership(session.token, actionModal.user.id, status);
      setActionMsg({ kind: 'success', text: status === 'permanent' ? '已升级为永久会员' : '已降级为免费用户' });
      loadUsers();
    } catch (err) {
      setActionMsg({ kind: 'error', text: err.message || '操作失败' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleDisable = async () => {
    if (!actionModal?.user) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      const willDisable = !actionModal.user.is_disabled;
      await adminSetDisabled(session.token, actionModal.user.id, willDisable);
      setActionMsg({ kind: 'success', text: willDisable ? '账号已禁用' : '账号已启用' });
      loadUsers();
      setActionModal({
        ...actionModal,
        user: { ...actionModal.user, is_disabled: willDisable },
      });
    } catch (err) {
      setActionMsg({ kind: 'error', text: err.message || '操作失败' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!actionModal?.user) return;
    if (!newPassword.trim() || newPassword.length < 6) {
      setActionMsg({ kind: 'error', text: '密码至少 6 位' });
      return;
    }
    setActionLoading(true);
    setActionMsg(null);
    try {
      await adminResetPassword(session.token, actionModal.user.username, newPassword);
      setActionMsg({ kind: 'success', text: '密码重置成功！' });
    } catch (err) {
      setActionMsg({ kind: 'error', text: err.message || '重置失败' });
    } finally {
      setActionLoading(false);
    }
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
        {/* 兑换码管理 */}
        {activeSection === 'redeem' && (
          <div className="admin-section">
            <div className="panel">
              <div className="panel-head">
                <div>
                  <p className="panel-kicker">创建兑换码</p>
                  <h2>生成新的兑换码</h2>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setBatchModalOpen(true)}
                >
                  批量生成
                </button>
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

              {/* 搜索筛选 */}
              <form className="search-bar" onSubmit={handleSearch}>
                <input
                  type="text"
                  placeholder="搜索兑换码..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="search-input"
                />
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setTimeout(loadCodes, 0); }}
                  className="filter-select"
                >
                  <option value="all">全部类型</option>
                  <option value="normal">普通次数码</option>
                  <option value="permanent">永久会员码</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setTimeout(loadCodes, 0); }}
                  className="filter-select"
                >
                  <option value="all">全部状态</option>
                  <option value="active">未使用</option>
                  <option value="used">已使用</option>
                </select>
                <button type="submit" className="secondary-button">搜索</button>
              </form>

              {loading && <div className="admin-loading">加载中…</div>}
              {loadError && <div className="notice error" style={{ marginBottom: '12px' }}><span>✕</span><span>{loadError}</span></div>}

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
                          <div className="action-btns">
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => copyCode(c.code)}
                            >
                              复制
                            </button>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => openEditModal(c)}
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              className="text-button danger"
                              onClick={() => handleDeleteCode(c)}
                            >
                              删除
                            </button>
                          </div>
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

        {/* 用户列表 */}
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
              {loadError && <div className="notice error" style={{ marginBottom: '12px' }}><span>✕</span><span>{loadError}</span></div>}

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>用户名</th>
                      <th>会员状态</th>
                      <th>剩余导出</th>
                      <th>剩余 AI</th>
                      <th>状态</th>
                      <th>操作</th>
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
                        <td>
                          <span className={`status-tag ${u.is_disabled ? 'disabled' : 'active'}`}>
                            {u.is_disabled ? '已禁用' : '正常'}
                          </span>
                        </td>
                        <td>
                          <div className="action-btns">
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => openModal('counts', u)}
                            >
                              调次数
                            </button>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => openModal('membership', u)}
                            >
                              会员
                            </button>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => openModal('password', u)}
                            >
                              改密码
                            </button>
                            <button
                              type="button"
                              className="text-button danger"
                              onClick={() => openModal('disable', u)}
                            >
                              {u.is_disabled ? '启用' : '禁用'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && !loading && (
                      <tr>
                        <td colSpan="6" className="empty-row">暂无用户</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 批量生成弹窗 */}
      {batchModalOpen && (
        <div className="modal-overlay" onClick={() => setBatchModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>批量生成兑换码</h3>
              <button type="button" className="modal-close" onClick={() => setBatchModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="admin-form-grid">
                <div className="admin-form-row">
                  <label>生成数量（1-100）</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={batchCount}
                    onChange={(e) => setBatchCount(e.target.value)}
                  />
                </div>
                <div className="admin-form-row">
                  <label>类型</label>
                  <select
                    value={batchType}
                    onChange={(e) => setBatchType(e.target.value)}
                    className="select-input"
                  >
                    <option value="normal">普通次数码</option>
                    <option value="permanent">永久会员码</option>
                  </select>
                </div>
              </div>
              <div className="admin-form-grid">
                <div className="admin-form-row">
                  <label>导出次数</label>
                  <input
                    type="number"
                    min="0"
                    value={batchExport}
                    onChange={(e) => setBatchExport(e.target.value)}
                  />
                </div>
                <div className="admin-form-row">
                  <label>AI 生图次数</label>
                  <input
                    type="number"
                    min="0"
                    value={batchAi}
                    onChange={(e) => setBatchAi(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={handleBatchCreate}
                disabled={batchLoading}
                style={{ marginTop: '16px', width: '100%' }}
              >
                {batchLoading ? '生成中…' : '开始生成'}
              </button>

              {batchResult.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong>生成成功！共 {batchResult.length} 个</strong>
                    <button
                      type="button"
                      className="text-button"
                      onClick={copyAllBatchCodes}
                    >
                      全部复制
                    </button>
                  </div>
                  <div className="batch-codes-list">
                    {batchResult.map((c) => (
                      <div key={c.id} className="batch-code-item">
                        <span className="code-cell">{c.code}</span>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => copyCode(c.code)}
                        >
                          复制
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 编辑兑换码弹窗 */}
      {editCode && (
        <div className="modal-overlay" onClick={() => setEditCode(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>编辑兑换码</h3>
              <button type="button" className="modal-close" onClick={() => setEditCode(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-user">兑换码：<strong>{editCode.code}</strong></p>

              {editMsg && (
                <div className={`notice ${editMsg.kind}`}>
                  <span>{editMsg.kind === 'success' ? '✓' : '✕'}</span>
                  <span>{editMsg.text}</span>
                </div>
              )}

              <div className="admin-form-row">
                <label>类型</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
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
                    value={editExport}
                    onChange={(e) => setEditExport(e.target.value)}
                  />
                </div>
                <div className="admin-form-row">
                  <label>AI 生图次数</label>
                  <input
                    type="number"
                    min="0"
                    value={editAi}
                    onChange={(e) => setEditAi(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={handleUpdateCode}
                disabled={editLoading}
                style={{ marginTop: '16px', width: '100%' }}
              >
                {editLoading ? '保存中…' : '保存修改'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 用户操作弹窗 */}
      {actionModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>
                {actionModal.type === 'counts' && '调整次数'}
                {actionModal.type === 'membership' && '会员管理'}
                {actionModal.type === 'password' && '重置密码'}
                {actionModal.type === 'disable' && '账号状态'}
              </h3>
              <button type="button" className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-user">用户：<strong>{actionModal.user.username}</strong></p>

              {actionMsg && (
                <div className={`notice ${actionMsg.kind}`}>
                  <span>{actionMsg.kind === 'success' ? '✓' : '✕'}</span>
                  <span>{actionMsg.text}</span>
                </div>
              )}

              {actionModal.type === 'counts' && (
                <>
                  <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px' }}>
                    当前：导出 {actionModal.user.remaining_export_count} 次 / AI {actionModal.user.remaining_ai_count} 次
                  </p>
                  <div className="admin-form-grid">
                    <div className="admin-form-row">
                      <label>导出次数调整（正数增加，负数减少）</label>
                      <input
                        type="number"
                        value={adjExport}
                        onChange={(e) => setAdjExport(e.target.value)}
                      />
                    </div>
                    <div className="admin-form-row">
                      <label>AI 次数调整（正数增加，负数减少）</label>
                      <input
                        type="number"
                        value={adjAi}
                        onChange={(e) => setAdjAi(e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleUpdateCounts}
                    disabled={actionLoading}
                    style={{ marginTop: '16px', width: '100%' }}
                  >
                    {actionLoading ? '处理中…' : '确认调整'}
                  </button>
                </>
              )}

              {actionModal.type === 'membership' && (
                <>
                  <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
                    当前状态：{actionModal.user.membership_status === 'permanent' ? '永久会员' : '免费用户'}
                  </p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => handleSetMembership('permanent')}
                      disabled={actionLoading || actionModal.user.membership_status === 'permanent'}
                      style={{ flex: 1 }}
                    >
                      升级永久会员
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleSetMembership('free')}
                      disabled={actionLoading || actionModal.user.membership_status !== 'permanent'}
                      style={{ flex: 1 }}
                    >
                      降级为免费
                    </button>
                  </div>
                </>
              )}

              {actionModal.type === 'password' && (
                <>
                  <div className="admin-form-row">
                    <label>新密码（至少 6 位）</label>
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="输入新密码"
                    />
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleResetPassword}
                    disabled={actionLoading}
                    style={{ marginTop: '16px', width: '100%' }}
                  >
                    {actionLoading ? '处理中…' : '重置密码'}
                  </button>
                </>
              )}

              {actionModal.type === 'disable' && (
                <>
                  <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
                    当前状态：{actionModal.user.is_disabled ? '已禁用（无法登录）' : '正常使用中'}
                  </p>
                  <button
                    type="button"
                    className={actionModal.user.is_disabled ? 'primary-button' : 'danger-button'}
                    onClick={handleToggleDisable}
                    disabled={actionLoading}
                    style={{ width: '100%' }}
                  >
                    {actionLoading ? '处理中…' : actionModal.user.is_disabled ? '启用账号' : '禁用账号'}
                  </button>
                  {!actionModal.user.is_disabled && (
                    <p style={{ color: '#999', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>
                      禁用后该用户将无法登录
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
