const express = require('express');
const router = express.Router();
const db = require('../db');
const riskEngine = require('../services/riskEngine');

router.post('/screen', (req, res) => {
  const { client_key, content, room_id, anchor_id, timestamp, debug_mode } = req.body;

  if (!client_key || !content) {
    return res.status(400).json({
      code: 400,
      message: '缺少必要参数：client_key 和 content 为必填项',
      data: null
    });
  }

  const client = db.client.getByKey(client_key);
  if (!client) {
    return res.status(401).json({
      code: 401,
      message: '无效的 client_key',
      data: null
    });
  }

  if (client.status !== 1) {
    return res.status(403).json({
      code: 403,
      message: '客户账号已停用',
      data: null
    });
  }

  const result = riskEngine.screenDanmaku(client.id, content);

  if (!debug_mode) {
    const danmakuTimestamp = timestamp || new Date().toISOString();

    db.danmakuLog.create(
      client.id,
      room_id || null,
      anchor_id || null,
      content,
      danmakuTimestamp,
      result.riskLevel,
      result.categories,
      result.hitReasons,
      result.suggestions,
      result.isRisky
    );
  }

  res.json({
    code: 200,
    message: 'success',
    data: {
      is_risky: result.isRisky,
      risk_level: result.riskLevel,
      risk_level_label: riskEngine.getRiskLevelLabel(result.riskLevel),
      risk_categories: result.categoryDetails || [],
      hit_reasons: result.hitReasons,
      suggestions: result.suggestions,
      whitelisted: result.whitelisted
    }
  });
});

router.post('/feedback', (req, res) => {
  const { client_key, danmaku_id, content, feedback_type, reason } = req.body;

  if (!client_key || !feedback_type) {
    return res.status(400).json({
      code: 400,
      message: '缺少必要参数',
      data: null
    });
  }

  const client = db.client.getByKey(client_key);
  if (!client) {
    return res.status(401).json({
      code: 401,
      message: '无效的 client_key',
      data: null
    });
  }

  const feedbackId = db.falsePositiveFeedback.create(
    danmaku_id || 0,
    client.id,
    content || '',
    feedback_type,
    reason || ''
  );

  res.json({
    code: 200,
    message: '反馈已提交',
    data: {
      feedback_id: feedbackId
    }
  });
});

module.exports = router;
