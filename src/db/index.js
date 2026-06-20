const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFile = path.join(dataDir, 'danmaku_risk.json');

let data = {
  clients: [],
  risk_categories: [],
  risk_keywords: [],
  whitelist: [],
  focus_words: [],
  danmaku_logs: [],
  false_positive_feedback: [],
  debug_history: [],
  _counters: {
    clients: 0,
    risk_categories: 0,
    risk_keywords: 0,
    whitelist: 0,
    focus_words: 0,
    danmaku_logs: 0,
    false_positive_feedback: 0,
    debug_history: 0
  }
};

function ensureDataStructure() {
  const defaults = {
    clients: [],
    risk_categories: [],
    risk_keywords: [],
    whitelist: [],
    focus_words: [],
    danmaku_logs: [],
    false_positive_feedback: [],
    debug_history: [],
    _counters: {
      clients: 0,
      risk_categories: 0,
      risk_keywords: 0,
      whitelist: 0,
      focus_words: 0,
      danmaku_logs: 0,
      false_positive_feedback: 0,
      debug_history: 0
    }
  };
  Object.keys(defaults).forEach(key => {
    if (data[key] === undefined) {
      data[key] = defaults[key];
    }
  });
  Object.keys(defaults._counters).forEach(key => {
    if (data._counters[key] === undefined) {
      data._counters[key] = defaults._counters[key];
    }
  });
}

function loadData() {
  if (fs.existsSync(dbFile)) {
    try {
      const content = fs.readFileSync(dbFile, 'utf-8');
      data = JSON.parse(content);
    } catch (e) {
      console.error('读取数据库文件失败:', e.message);
    }
  }
  ensureDataStructure();
}

function saveData() {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf-8');
}

function nextId(collection) {
  data._counters[collection] = (data._counters[collection] || 0) + 1;
  return data._counters[collection];
}

function now() {
  return new Date().toISOString();
}

loadData();

const clientModel = {
  getAll() {
    return [...data.clients].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getByKey(clientKey) {
    return data.clients.find(c => c.client_key === clientKey);
  },

  getById(id) {
    return data.clients.find(c => c.id === id);
  },

  create(clientKey, clientName, industry) {
    const id = nextId('clients');
    const client = {
      id,
      client_key: clientKey,
      client_name: clientName,
      industry: industry || '',
      status: 1,
      created_at: now(),
      updated_at: now()
    };
    data.clients.push(client);
    saveData();
    return id;
  },

  update(id, clientName, industry, status) {
    const client = data.clients.find(c => c.id === id);
    if (client) {
      client.client_name = clientName;
      client.industry = industry;
      client.status = status;
      client.updated_at = now();
      saveData();
    }
    return { changes: client ? 1 : 0 };
  },

  delete(id) {
    const index = data.clients.findIndex(c => c.id === id);
    if (index > -1) {
      data.clients.splice(index, 1);
      saveData();
    }
    return { changes: index > -1 ? 1 : 0 };
  }
};

const riskCategoryModel = {
  getByClientId(clientId) {
    return data.risk_categories
      .filter(c => c.client_id === clientId && c.status === 1)
      .sort((a, b) => b.risk_level - a.risk_level);
  },

  getById(id) {
    return data.risk_categories.find(c => c.id === id);
  },

  create(clientId, categoryCode, categoryName, description, riskLevel, suggestion) {
    const id = nextId('risk_categories');
    const cat = {
      id,
      client_id: clientId,
      category_code: categoryCode,
      category_name: categoryName,
      description: description || '',
      risk_level: riskLevel || 2,
      suggestion: suggestion || '',
      status: 1,
      created_at: now()
    };
    data.risk_categories.push(cat);
    saveData();
    return id;
  },

  update(id, categoryName, description, riskLevel, suggestion, status) {
    const cat = data.risk_categories.find(c => c.id === id);
    if (cat) {
      cat.category_name = categoryName;
      cat.description = description;
      cat.risk_level = riskLevel;
      cat.suggestion = suggestion;
      cat.status = status;
      saveData();
    }
    return { changes: cat ? 1 : 0 };
  },

  remove(id) {
    const index = data.risk_categories.findIndex(c => c.id === id);
    if (index > -1) {
      data.risk_categories.splice(index, 1);
      data.risk_keywords = data.risk_keywords.filter(k => k.category_id !== id);
      saveData();
    }
    return { changes: index > -1 ? 1 : 0 };
  }
};

const riskKeywordModel = {
  getByCategoryId(categoryId) {
    return data.risk_keywords
      .filter(k => k.category_id === categoryId)
      .sort((a, b) => b.weight - a.weight);
  },

  getByClientId(clientId) {
    const categories = data.risk_categories.filter(c => c.client_id === clientId && c.status === 1);
    const categoryIds = categories.map(c => c.id);
    return data.risk_keywords
      .filter(k => categoryIds.includes(k.category_id))
      .map(k => {
        const cat = categories.find(c => c.id === k.category_id);
        return {
          ...k,
          category_code: cat ? cat.category_code : '',
          category_name: cat ? cat.category_name : '',
          category_level: cat ? cat.risk_level : 0
        };
      });
  },

  getById(id) {
    return data.risk_keywords.find(k => k.id === id);
  },

  create(categoryId, keyword, matchType, weight) {
    const id = nextId('risk_keywords');
    const kw = {
      id,
      category_id: categoryId,
      keyword,
      match_type: matchType || 'contains',
      weight: weight || 1,
      created_at: now()
    };
    data.risk_keywords.push(kw);
    saveData();
    return id;
  },

  remove(id) {
    const index = data.risk_keywords.findIndex(k => k.id === id);
    if (index > -1) {
      data.risk_keywords.splice(index, 1);
      saveData();
    }
    return { changes: index > -1 ? 1 : 0 };
  },

  batchCreate(categoryId, keywords) {
    for (const kw of keywords) {
      this.create(categoryId, kw.keyword, kw.match_type || 'contains', kw.weight || 1);
    }
  }
};

const whitelistModel = {
  getByClientId(clientId) {
    return data.whitelist
      .filter(w => w.client_id === clientId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getById(id) {
    return data.whitelist.find(w => w.id === id);
  },

  create(clientId, word, wordType, reason, createdBy) {
    const id = nextId('whitelist');
    const item = {
      id,
      client_id: clientId,
      word,
      word_type: wordType || 'common',
      reason: reason || '',
      created_by: createdBy || 'admin',
      created_at: now()
    };
    data.whitelist.push(item);
    saveData();
    return id;
  },

  remove(id) {
    const index = data.whitelist.findIndex(w => w.id === id);
    if (index > -1) {
      data.whitelist.splice(index, 1);
      saveData();
    }
    return { changes: index > -1 ? 1 : 0 };
  },

  getWordsByClientId(clientId) {
    return data.whitelist
      .filter(w => w.client_id === clientId)
      .map(w => w.word);
  }
};

const focusWordModel = {
  getByClientId(clientId) {
    return data.focus_words
      .filter(f => f.client_id === clientId)
      .sort((a, b) => b.focus_level - a.focus_level || new Date(b.created_at) - new Date(a.created_at));
  },

  getById(id) {
    return data.focus_words.find(f => f.id === id);
  },

  create(clientId, word, focusLevel, reason, createdBy) {
    const id = nextId('focus_words');
    const item = {
      id,
      client_id: clientId,
      word,
      focus_level: focusLevel || 1,
      reason: reason || '',
      created_by: createdBy || 'admin',
      created_at: now()
    };
    data.focus_words.push(item);
    saveData();
    return id;
  },

  remove(id) {
    const index = data.focus_words.findIndex(f => f.id === id);
    if (index > -1) {
      data.focus_words.splice(index, 1);
      saveData();
    }
    return { changes: index > -1 ? 1 : 0 };
  }
};

const danmakuLogModel = {
  create(clientId, roomId, anchorId, content, timestamp, riskLevel, riskCategories, hitReasons, suggestions, isRisky) {
    const id = nextId('danmaku_logs');
    const log = {
      id,
      client_id: clientId,
      room_id: roomId || null,
      anchor_id: anchorId || null,
      content,
      timestamp: timestamp || now(),
      risk_level: riskLevel,
      risk_categories: JSON.stringify(riskCategories),
      hit_reasons: JSON.stringify(hitReasons),
      suggestions: JSON.stringify(suggestions),
      is_risky: isRisky ? 1 : 0,
      created_at: now()
    };
    data.danmaku_logs.push(log);
    if (data.danmaku_logs.length > 10000) {
      data.danmaku_logs = data.danmaku_logs.slice(-5000);
    }
    saveData();
    return id;
  },

  getByClientId(clientId, limit = 100, offset = 0) {
    const logs = data.danmaku_logs
      .filter(d => d.client_id === clientId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(offset, offset + limit);
    return logs;
  },

  getRiskyByClientId(clientId, limit = 50) {
    return data.danmaku_logs
      .filter(d => d.client_id === clientId && d.is_risky === 1)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  },

  getById(id) {
    return data.danmaku_logs.find(d => d.id === id);
  }
};

const falsePositiveFeedbackModel = {
  create(danmakuId, clientId, content, feedbackType, reason) {
    const id = nextId('false_positive_feedback');
    const fb = {
      id,
      danmaku_id: danmakuId || 0,
      client_id: clientId,
      content: content || '',
      feedback_type: feedbackType,
      reason: reason || '',
      handled: 0,
      handled_by: null,
      handled_at: null,
      handle_conclusion: null,
      handle_action: null,
      handle_action_detail: null,
      created_at: now()
    };
    data.false_positive_feedback.push(fb);
    saveData();
    return id;
  },

  getByClientId(clientId, handled = null, limit = 50) {
    let list = data.false_positive_feedback.filter(f => f.client_id === clientId);
    
    if (handled !== null) {
      list = list.filter(f => f.handled === (handled ? 1 : 0));
    }
    
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return list.slice(0, limit);
  },

  getById(id) {
    return data.false_positive_feedback.find(f => f.id === id);
  },

  markHandled(id, handledBy, conclusion, action, actionDetail) {
    const fb = data.false_positive_feedback.find(f => f.id === id);
    if (fb) {
      fb.handled = 1;
      fb.handled_by = handledBy || 'admin';
      fb.handled_at = now();
      fb.handle_conclusion = conclusion || null;
      fb.handle_action = action || null;
      fb.handle_action_detail = actionDetail || null;
      saveData();
    }
    return { changes: fb ? 1 : 0 };
  },

  getStats(clientId) {
    const list = data.false_positive_feedback.filter(f => f.client_id === clientId);
    const result = {};
    
    list.forEach(f => {
      if (!result[f.feedback_type]) {
        result[f.feedback_type] = { total: 0, handled: 0 };
      }
      result[f.feedback_type].total++;
      if (f.handled) result[f.feedback_type].handled++;
    });
    
    return Object.entries(result).map(([type, stats]) => ({
      feedback_type: type,
      total: stats.total,
      handled: stats.handled
    }));
  }
};

const statsModel = {
  getMonthlyStats(clientId, year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    const monthLogs = data.danmaku_logs.filter(d => {
      const t = new Date(d.timestamp);
      return d.client_id === clientId && t >= startDate && t <= endDate;
    });
    
    const totalCalls = monthLogs.length;
    const riskyCount = monthLogs.filter(d => d.is_risky === 1).length;
    
    const monthFeedback = data.false_positive_feedback.filter(f => {
      const t = new Date(f.created_at);
      return f.client_id === clientId && t >= startDate && t <= endDate;
    });
    const feedbackCount = monthFeedback.length;
    
    const categoryMap = {};
    const categories = data.risk_categories.filter(c => c.client_id === clientId);
    
    monthLogs.filter(d => d.is_risky === 1).forEach(d => {
      try {
        const cats = JSON.parse(d.risk_categories || '[]');
        if (cats.length > 0) {
          const firstCat = cats[0];
          if (!categoryMap[firstCat]) categoryMap[firstCat] = 0;
          categoryMap[firstCat]++;
        }
      } catch(e) {}
    });
    
    const categoryBreakdown = categories
      .map(c => ({
        category_name: c.category_name,
        category_code: c.category_code,
        hit_count: categoryMap[c.category_code] || 0
      }))
      .filter(c => c.hit_count > 0)
      .sort((a, b) => b.hit_count - a.hit_count);
    
    const levelMap = {};
    monthLogs.forEach(d => {
      if (!levelMap[d.risk_level]) levelMap[d.risk_level] = 0;
      levelMap[d.risk_level]++;
    });
    
    const riskLevelDistribution = Object.entries(levelMap)
      .map(([level, count]) => ({ risk_level: parseInt(level), count }))
      .sort((a, b) => b.risk_level - a.risk_level);
    
    const sampleDanmakus = monthLogs
      .filter(d => d.is_risky === 1)
      .sort((a, b) => b.risk_level - a.risk_level || new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20)
      .map(d => ({
        content: d.content,
        risk_level: d.risk_level,
        hit_reasons: d.hit_reasons,
        timestamp: d.timestamp
      }));
    
    return {
      totalCalls,
      riskyCount,
      hitRate: totalCalls > 0 ? (riskyCount / totalCalls * 100).toFixed(2) : '0.00',
      feedbackCount,
      manualConfirmRate: riskyCount > 0 ? (feedbackCount / riskyCount * 100).toFixed(2) : '0.00',
      categoryBreakdown,
      riskLevelDistribution,
      sampleDanmakus
    };
  },

  getDailyTrend(clientId, days = 30) {
    const now = new Date();
    const results = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayLogs = data.danmaku_logs.filter(d => {
        const t = new Date(d.timestamp);
        return d.client_id === clientId && t.toISOString().split('T')[0] === dateStr;
      });
      
      results.push({
        date: dateStr,
        total: dayLogs.length,
        risky: dayLogs.filter(d => d.is_risky === 1).length
      });
    }
    
    return results.reverse();
  }
};

const debugHistoryModel = {
  create(clientId, inputDanmakus, results, remark) {
    const id = nextId('debug_history');
    const record = {
      id,
      client_id: clientId,
      input_danmakus: inputDanmakus || [],
      results: results || [],
      remark: remark || '',
      created_at: now()
    };
    data.debug_history.push(record);
    if (data.debug_history.length > 200) {
      data.debug_history = data.debug_history.slice(-100);
    }
    saveData();
    return id;
  },

  getByClientId(clientId, limit = 50) {
    return data.debug_history
      .filter(d => d.client_id === clientId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  },

  getById(id) {
    return data.debug_history.find(d => d.id === id);
  },

  remove(id) {
    const index = data.debug_history.findIndex(d => d.id === id);
    if (index > -1) {
      data.debug_history.splice(index, 1);
      saveData();
    }
    return { changes: index > -1 ? 1 : 0 };
  }
};

function seedSampleData() {
  if (data.clients.length > 0) {
    console.log('已存在示例数据，跳过初始化');
    return;
  }

  const makeupId = clientModel.create('makeup_001', '美妆优选', '美妆');
  const gameId = clientModel.create('game_001', '星辰游戏', '游戏');

  const makeupCat1 = riskCategoryModel.create(makeupId, 'false_efficacy', '虚假功效宣传', '涉及夸大产品功效、虚假宣传等内容', 3, '建议立即删除弹幕，情节严重可禁言');
  const makeupCat2 = riskCategoryModel.create(makeupId, 'complaint', '投诉维权', '涉及产品质量投诉、维权等内容', 2, '建议客服介入跟进，记录反馈');
  const makeupCat3 = riskCategoryModel.create(makeupId, 'pornographic', '涉黄擦边', '涉及低俗、色情擦边内容', 3, '建议立即删除，严重者封禁');

  const gameCat1 = riskCategoryModel.create(gameId, 'cheat', '外挂作弊', '涉及游戏外挂、作弊软件相关内容', 3, '建议立即删除弹幕，封禁账号');
  const gameCat2 = riskCategoryModel.create(gameId, 'minor', '未成年人相关', '涉及未成年人不良引导内容', 3, '建议立即删除，重点关注');
  const gameCat3 = riskCategoryModel.create(gameId, 'pornographic', '涉黄擦边', '涉及低俗、色情擦边内容', 2, '建议删除弹幕，警告处理');

  const makeupKeywords = [
    { keyword: '七天变白', weight: 2 },
    { keyword: '永久祛斑', weight: 2 },
    { keyword: '根治', weight: 1 },
    { keyword: '100%有效', weight: 2 },
    { keyword: '无效退款', weight: 1 },
  ];
  riskKeywordModel.batchCreate(makeupCat1, makeupKeywords);

  const complaintKeywords = [
    { keyword: '假货', weight: 2 },
    { keyword: '烂脸', weight: 2 },
    { keyword: '过敏', weight: 1 },
    { keyword: '投诉', weight: 1 },
    { keyword: '退款', weight: 1 },
  ];
  riskKeywordModel.batchCreate(makeupCat2, complaintKeywords);

  const pornKeywords1 = [
    { keyword: '骚', weight: 2 },
    { keyword: '露', weight: 1 },
  ];
  riskKeywordModel.batchCreate(makeupCat3, pornKeywords1);

  const cheatKeywords = [
    { keyword: '外挂', weight: 3 },
    { keyword: '辅助', weight: 1 },
    { keyword: '脚本', weight: 2 },
    { keyword: '挂壁', weight: 2 },
    { keyword: '科技', weight: 1 },
  ];
  riskKeywordModel.batchCreate(gameCat1, cheatKeywords);

  const minorKeywords = [
    { keyword: '小学生', weight: 1 },
    { keyword: '未成年', weight: 2 },
    { keyword: '充值', weight: 1 },
  ];
  riskKeywordModel.batchCreate(gameCat2, minorKeywords);

  const pornKeywords2 = [
    { keyword: '骚', weight: 2 },
    { keyword: '黄', weight: 1 },
  ];
  riskKeywordModel.batchCreate(gameCat3, pornKeywords2);

  whitelistModel.create(makeupId, '666', 'catchphrase', '常见口头禅', 'admin');
  whitelistModel.create(makeupId, '绝绝子', 'catchphrase', '网络流行语', 'admin');
  whitelistModel.create(gameId, '666', 'catchphrase', '常见口头禅', 'admin');
  whitelistModel.create(gameId, '牛批', 'catchphrase', '游戏常用语', 'admin');

  console.log('示例数据初始化完成');
}

seedSampleData();

module.exports = {
  client: clientModel,
  riskCategory: riskCategoryModel,
  riskKeyword: riskKeywordModel,
  whitelist: whitelistModel,
  focusWord: focusWordModel,
  danmakuLog: danmakuLogModel,
  falsePositiveFeedback: falsePositiveFeedbackModel,
  stats: statsModel,
  debugHistory: debugHistoryModel
};
