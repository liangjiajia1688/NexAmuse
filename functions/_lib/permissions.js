// Membership level permissions helper
// Tiers: Standard < Premium < VIP. Admins (role === 'admin') bypass all gates.
export const LEVELS = { Standard: 1, Premium: 2, VIP: 3 };

export function levelRank(user) {
  if (!user) return 0;
  if (user.role === 'admin') return 99; // admins bypass level gates
  return LEVELS[user.level] || 1;
}

export function canUploadProduct(user) {
  return levelRank(user) >= LEVELS.Premium;
}

export function canPublishArticle(user) {
  return levelRank(user) >= LEVELS.Premium;
}

export function canCreateCompanyPage(user) {
  return levelRank(user) >= LEVELS.Premium;
}

export function canManageCompanyProducts(user) {
  return levelRank(user) >= LEVELS.Premium;
}

export function canPostForumUnlimited(user) {
  return levelRank(user) >= LEVELS.Premium;
}

export function canCommentUnlimited(user) {
  return levelRank(user) >= LEVELS.Premium;
}

export function hasPriorityInquiry(user) {
  return levelRank(user) >= LEVELS.Premium;
}

export function hasCompanySortPriority(user) {
  return levelRank(user) >= LEVELS.VIP;
}

export function hasFeaturedSupplierBadge(user) {
  return levelRank(user) >= LEVELS.VIP;
}

export function hasAdFreeBrowsing(user) {
  return levelRank(user) >= LEVELS.VIP;
}

export function canDirectMessage(user) {
  return levelRank(user) >= LEVELS.VIP;
}

export function canAccessVipForum(user) {
  return levelRank(user) >= LEVELS.VIP;
}

export function hasEarlyExhibitionAccess(user) {
  return levelRank(user) >= LEVELS.VIP;
}

// Daily limits (used by frontend and backend)
export const DAILY_LIMITS = {
  forumPost: { Standard: 1, Premium: Infinity, VIP: Infinity },
  comment: { Standard: 1, Premium: Infinity, VIP: Infinity }
};

export function requireLevel(user, minLevel, actionName) {
  if (!user) return { ok: false, code: 401, message: 'Login required' };
  if (user.status === 'banned') return { ok: false, code: 403, message: 'Account banned' };
  if (levelRank(user) >= LEVELS[minLevel]) return { ok: true };
  return {
    ok: false,
    code: 403,
    message: `${actionName} requires ${minLevel} membership or higher.`,
    required: minLevel
  };
}
