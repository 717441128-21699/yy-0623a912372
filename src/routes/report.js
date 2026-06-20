const express = require('express');
const router = express.Router();
const db = require('../db');
const riskEngine = require('../services/riskEngine');

router.get('/clients/:clientId/feedback', (req, res) => {
  const clientId = parseInt(req.params.clientId);
  const { handled, limit } = req.query;
  
  const handledParam = handled !== undefined ? (handled === 'true' || handled === '1') : null;
  const limitParam = limit ? parseInt(limit) : 50;
  
  const feedback = db.falsePositiveFeedback.getByClientId(clientId, handledParam, limitParam);
  res.json({ code: 200, message: 'success', data: feedback });
});

router.post('/feedback/:id/handle', (req, res) => {
  const id = parseInt(req.params.id);
  const { handled_by } = req.body;
  
  db.falsePositiveFeedback.markHandled(id, handled_by || 'admin');
  res.json({ code: 200, message: '已标记为已处理', data: null });
});

router.get('/stats/monthly/:clientId', (req, res) => {
  const clientId = parseInt(req.params.clientId);
  const { year, month } = req.query;
  
  const now = new Date();
  const y = year ? parseInt(year) : now.getFullYear();
  const m = month ? parseInt(month) : now.getMonth() + 1;
  
  const stats = db.stats.getMonthlyStats(clientId, y, m);
  
  const client = db.client.getById(clientId);
  
  res.json({
    code: 200,
    message: 'success',
    data: {
      client_name: client ? client.client_name : '',
      year: y,
      month: m,
      ...stats
    }
  });
});

router.get('/stats/trend/:clientId', (req, res) => {
  const clientId = parseInt(req.params.clientId);
  const { days } = req.query;
  
  const daysParam = days ? parseInt(days) : 30;
  const trend = db.stats.getDailyTrend(clientId, daysParam);
  
  res.json({ code: 200, message: 'success', data: trend });
});

router.get('/clients/:clientId/danmakus', (req, res) => {
  const clientId = parseInt(req.params.clientId);
  const { risky, limit, offset } = req.query;
  
  const limitParam = limit ? parseInt(limit) : 100;
  const offsetParam = offset ? parseInt(offset) : 0;
  
  let danmakus;
  if (risky === 'true' || risky === '1') {
    danmakus = db.danmakuLog.getRiskyByClientId(clientId, limitParam);
  } else {
    danmakus = db.danmakuLog.getByClientId(clientId, limitParam, offsetParam);
  }
  
  danmakus = danmakus.map(d => ({
    ...d,
    risk_categories: d.risk_categories ? JSON.parse(d.risk_categories) : [],
    hit_reasons: d.hit_reasons ? JSON.parse(d.hit_reasons) : [],
    suggestions: d.suggestions ? JSON.parse(d.suggestions) : [],
    risk_level_label: riskEngine.getRiskLevelLabel(d.risk_level)
  }));
  
  res.json({ code: 200, message: 'success', data: danmakus });
});

module.exports = router;
