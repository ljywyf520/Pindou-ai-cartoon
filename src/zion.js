const DEFAULT_ENDPOINT = 'https://zion-app.functorz.com/zero/mwLZrNjJ44A/api/graphql-v2';
const GRAPHQL_ENDPOINT = import.meta.env.VITE_ZION_GRAPHQL_ENDPOINT || DEFAULT_ENDPOINT;
const STORAGE_KEY = 'douge.zion.session';

const AUTH_MUTATION = /* GraphQL */ `
  mutation AuthenticateWithUsername($username: String!, $password: String!, $register: Boolean!) {
    authenticateWithUsername(username: $username, password: $password, register: $register) {
      account {
        id
        username
        permissionRoles
      }
      jwt {
        token
      }
    }
  }
`;

const USER_QUERY = /* GraphQL */ `
  query UserByUsername($username: String!) {
    user(where: { username: { _eq: $username } }, limit: 1) {
      id
      username
      remaining_export_count
      remaining_ai_count
      membership_status
    }
  }
`;

const USER_BY_ID_QUERY = /* GraphQL */ `
  query UserById($id: ID!) {
    user_by_pk(id: $id) {
      id
      username
      remaining_export_count
      remaining_ai_count
      membership_status
    }
  }
`;

const USER_INSERT = /* GraphQL */ `
  mutation CreateUser($username: String!, $membershipStatus: String!) {
    insert_user_one(
      object: {
        username: $username
        remaining_export_count: 0
        remaining_ai_count: 0
        membership_status: $membershipStatus
      }
    ) {
      id
      username
      remaining_export_count
      remaining_ai_count
      membership_status
    }
  }
`;

const DECREMENT_EXPORT = /* GraphQL */ `
  mutation DecrementExportCount($id: ID!) {
    update_user_by_pk(
      pk_columns: { id: $id }
      _inc: { remaining_export_count: -1 }
    ) {
      id
      remaining_export_count
      remaining_ai_count
      membership_status
    }
  }
`;

const DECREMENT_AI = /* GraphQL */ `
  mutation DecrementAiCount($id: ID!) {
    update_user_by_pk(
      pk_columns: { id: $id }
      _inc: { remaining_ai_count: -1 }
    ) {
      id
      remaining_export_count
      remaining_ai_count
      membership_status
    }
  }
`;

const REDEEM_CODE_QUERY = /* GraphQL */ `
  query RedeemCodeQuery($code: String!) {
    redeem_code(where: { code: { _eq: $code }, status: { _eq: "active" } }, limit: 1) {
      id
      code
      type
      export_count
      ai_count
      status
    }
  }
`;

const MARK_CODE_USED = /* GraphQL */ `
  mutation MarkCodeUsed($codeId: ID!, $userId: ID!) {
    update_redeem_code_by_pk(
      pk_columns: { id: $codeId }
      _set: { status: "used", used_by: $userId, used_at: "now" }
    ) {
      id
      status
    }
  }
`;

const ADD_USER_BENEFITS = /* GraphQL */ `
  mutation AddUserBenefits($userId: ID!, $exportDelta: bigint!, $aiDelta: bigint!, $membership: String) {
    update_user_by_pk(
      pk_columns: { id: $userId }
      _inc: { remaining_export_count: $exportDelta, remaining_ai_count: $aiDelta }
      _set: { membership_status: $membership }
    ) {
      id
      remaining_export_count
      remaining_ai_count
      membership_status
    }
  }
`;

export function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  localStorage.removeItem(STORAGE_KEY);
}

async function request(query, variables, token) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json();
  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.[0]?.message || `请求失败（${response.status}）`;
    throw new Error(message);
  }

  return payload.data;
}

export async function authenticateWithUsername({ username, password, register }) {
  return request(AUTH_MUTATION, { username, password, register }, null);
}

export async function fetchUserProfile(username, token) {
  const data = await request(USER_QUERY, { username }, token);
  return data.user?.[0] ?? null;
}

export async function ensureUserProfile(username, token) {
  const existing = await fetchUserProfile(username, token);
  if (existing) return existing;

  const data = await request(USER_INSERT, { username, membershipStatus: 'free' }, token);
  return data.insert_user_one;
}

// 扣减导出次数
export async function decrementExportCount(userId, token) {
  const data = await request(DECREMENT_EXPORT, { id: userId }, token);
  return data.update_user_by_pk;
}

// 扣减AI生图次数
export async function decrementAiCount(userId, token) {
  const data = await request(DECREMENT_AI, { id: userId }, token);
  return data.update_user_by_pk;
}

// 兑换码兑换
export async function redeemCode(code, userId, token) {
  // 1. 查询兑换码
  const codeData = await request(REDEEM_CODE_QUERY, { code }, token);
  const redeemCode = codeData.redeem_code?.[0];

  if (!redeemCode) {
    throw new Error('兑换码无效或已使用。');
  }

  if (redeemCode.status !== 'active') {
    throw new Error('该兑换码已使用。');
  }

  // 2. 给用户加权益
  const exportDelta = redeemCode.export_count || 0;
  const aiDelta = redeemCode.ai_count || 0;
  let membership = undefined;

  if (redeemCode.type === 'permanent') {
    membership = 'permanent';
  }

  const userData = await request(ADD_USER_BENEFITS, {
    userId,
    exportDelta,
    aiDelta,
    membership,
  }, token);

  // 3. 标记兑换码已使用
  try {
    await request(MARK_CODE_USED, { codeId: redeemCode.id, userId }, token);
  } catch (e) {
    console.warn('标记兑换码已使用失败', e);
  }

  return userData.update_user_by_pk;
}

// ============================================================
// 管理员功能
// ============================================================

const ADMIN_USER_LIST = /* GraphQL */ `
  query AdminUserList($limit: Int!, $offset: Int!) {
    user(order_by: { id: desc }, limit: $limit, offset: $offset) {
      id
      username
      remaining_export_count
      remaining_ai_count
      membership_status
    }
    user_aggregate {
      aggregate {
        count
      }
    }
  }
`;

const ADMIN_REDEEM_LIST = /* GraphQL */ `
  query AdminRedeemList($limit: Int!, $offset: Int!) {
    redeem_code(order_by: { id: desc }, limit: $limit, offset: $offset) {
      id
      code
      type
      export_count
      ai_count
      status
      used_by
      used_at
    }
    redeem_code_aggregate {
      aggregate {
        count
      }
    }
  }
`;

const ADMIN_CREATE_REDEEM = /* GraphQL */ `
  mutation AdminCreateRedeem($code: String!, $type: String!, $exportCount: bigint!, $aiCount: bigint!) {
    insert_redeem_code_one(
      object: {
        code: $code
        type: $type
        export_count: $exportCount
        ai_count: $aiCount
        status: "active"
      }
    ) {
      id
      code
      type
      export_count
      ai_count
      status
    }
  }
`;

// 管理员用户名（Zion 注册系统会防止重复用户名，所以唯一）
const ADMIN_USERNAME = 'ljy520';

// 管理员密钥（进入后台时需输入，双重保险）
export const ADMIN_KEY = 'douge2026';

// 判断是否为管理员账号（仅检查用户名，Zion 保证用户名唯一）
export function isAdmin(account) {
  return account?.username === ADMIN_USERNAME;
}

// 管理员：获取用户列表
export async function adminListUsers(token, limit = 20, offset = 0) {
  const data = await request(ADMIN_USER_LIST, { limit, offset }, token);
  return {
    users: data.user || [],
    total: data.user_aggregate?.aggregate?.count ?? 0,
  };
}

// 管理员：获取兑换码列表
export async function adminListRedeemCodes(token, limit = 20, offset = 0) {
  const data = await request(ADMIN_REDEEM_LIST, { limit, offset }, token);
  return {
    codes: data.redeem_code || [],
    total: data.redeem_code_aggregate?.aggregate?.count ?? 0,
  };
}

// 管理员：创建兑换码
export async function adminCreateRedeemCode(token, { code, type, exportCount, aiCount }) {
  const data = await request(ADMIN_CREATE_REDEEM, {
    code: code.toUpperCase(),
    type,
    exportCount,
    aiCount,
  }, token);
  return data.insert_redeem_code_one;
}
