const db = require('../db');

const ruleCache = new Map();
const CACHE_TTL = 60000;

function getClientRules(clientId) {
  const now = Date.now();
  const cached = ruleCache.get(clientId);
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  const categories = db.riskCategory.getByClientId(clientId);
  const keywords = db.riskKeyword.getByClientId(clientId);
  const whitelistWords = db.whitelist.getWordsByClientId(clientId);
  const focusWords = db.focusWord.getByClientId(clientId);

  const keywordByCategory = {};
  categories.forEach(cat => {
    keywordByCategory[cat.id] = [];
  });
  
  keywords.forEach(kw => {
    if (keywordByCategory[kw.category_id]) {
      keywordByCategory[kw.category_id].push(kw);
    }
  });

  const data = {
    categories,
    keywords,
    keywordByCategory,
    whitelistWords,
    focusWords
  };

  ruleCache.set(clientId, {
    timestamp: now,
    data
  });

  return data;
}

function invalidateCache(clientId) {
  ruleCache.delete(clientId);
}

function containsWord(text, word) {
  return text.indexOf(word) !== -1;
}

function matchesKeyword(text, keywordObj) {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keywordObj.keyword.toLowerCase();
  
  switch (keywordObj.match_type) {
    case 'exact':
      return lowerText === lowerKeyword;
    case 'regex':
      try {
        const regex = new RegExp(lowerKeyword, 'i');
        return regex.test(text);
      } catch (e) {
        return containsWord(lowerText, lowerKeyword);
      }
    case 'contains':
    default:
      return containsWord(lowerText, lowerKeyword);
  }
}

function isWhitelisted(text, whitelistWords) {
  const lowerText = text.toLowerCase();
  for (const word of whitelistWords) {
    if (containsWord(lowerText, word.toLowerCase())) {
      return true;
    }
  }
  return false;
}

function screenDanmaku(clientId, content) {
  const rules = getClientRules(clientId);
  const { categories, keywordByCategory, whitelistWords, focusWords } = rules;

  if (isWhitelisted(content, whitelistWords)) {
    return {
      isRisky: false,
      riskLevel: 0,
      categories: [],
      hitReasons: [],
      suggestions: [],
      whitelisted: true
    };
  }

  const hitCategories = [];
  const hitReasons = [];
  const suggestions = [];
  let maxRiskLevel = 0;

  categories.forEach(category => {
    const keywords = keywordByCategory[category.id] || [];
    const hitKeywords = [];
    let totalWeight = 0;

    keywords.forEach(kw => {
      if (matchesKeyword(content, kw)) {
        hitKeywords.push(kw.keyword);
        totalWeight += kw.weight;
      }
    });

    if (hitKeywords.length > 0) {
      hitCategories.push({
        code: category.category_code,
        name: category.category_name,
        level: category.risk_level,
        hitCount: hitKeywords.length,
        totalWeight
      });

      hitReasons.push({
        category: category.category_name,
        categoryCode: category.category_code,
        keywords: hitKeywords,
        description: `命中${category.category_name}类别，关键词：${hitKeywords.join('、')}`
      });

      if (category.suggestion) {
        suggestions.push(category.suggestion);
      }

      if (category.risk_level > maxRiskLevel) {
        maxRiskLevel = category.risk_level;
      }
    }
  });

  focusWords.forEach(fw => {
    if (containsWord(content.toLowerCase(), fw.word.toLowerCase())) {
      if (!hitReasons.some(r => r.categoryCode === 'focus_word')) {
        hitReasons.push({
          category: '重点关注',
          categoryCode: 'focus_word',
          keywords: [fw.word],
          description: `命中重点关注词：${fw.word}`
        });
      }
      if (maxRiskLevel < fw.focus_level) {
        maxRiskLevel = Math.max(maxRiskLevel, fw.focus_level);
      }
    }
  });

  const isRisky = hitCategories.length > 0 || hitReasons.some(r => r.categoryCode === 'focus_word');

  hitCategories.sort((a, b) => b.level - a.level);

  return {
    isRisky,
    riskLevel: maxRiskLevel,
    categories: hitCategories.map(c => c.code),
    categoryDetails: hitCategories,
    hitReasons,
    suggestions: [...new Set(suggestions)],
    whitelisted: false
  };
}

function getRiskLevelLabel(level) {
  const labels = {
    0: '无风险',
    1: '低风险',
    2: '中风险',
    3: '高风险'
  };
  return labels[level] || '未知';
}

module.exports = {
  screenDanmaku,
  invalidateCache,
  getClientRules,
  getRiskLevelLabel
};
