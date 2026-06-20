const express = require('express');
const router = express.Router();
const db = require('../db');
const riskEngine = require('../services/riskEngine');

router.get('/clients', (req, res) => {
  const clients = db.client.getAll();
  res.json({ code: 200, message: 'success', data: clients });
});

router.post('/clients', (req, res) => {
  const { client_key, client_name, industry } = req.body;
  
  if (!client_key || !client_name) {
    return res.status(400).json({ code: 400, message: '缺少必要参数', data: null });
  }

  const existing = db.client.getByKey(client_key);
  if (existing) {
    return res.status(400).json({ code: 400, message: 'Client Key 已存在，请使用其他标识', data: null });
  }

  try {
    const id = db.client.create(client_key, client_name, industry || '');
    const newClient = db.client.getById(id);
    res.json({ code: 200, message: '创建成功', data: { id, client: newClient } });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message, data: null });
  }
});

router.put('/clients/:id', (req, res) => {
  const { client_name, industry, status } = req.body;
  const id = parseInt(req.params.id);
  
  db.client.update(id, client_name, industry, status);
  riskEngine.invalidateCache(id);
  const updatedClient = db.client.getById(id);
  res.json({ code: 200, message: '更新成功', data: { client: updatedClient } });
});

router.delete('/clients/:id', (req, res) => {
  const id = parseInt(req.params.id);
  db.client.delete(id);
  riskEngine.invalidateCache(id);
  res.json({ code: 200, message: '删除成功', data: null });
});

router.get('/clients/:id/categories', (req, res) => {
  const clientId = parseInt(req.params.id);
  const categories = db.riskCategory.getByClientId(clientId);
  
  const categoriesWithKeywords = categories.map(cat => {
    const keywords = db.riskKeyword.getByCategoryId(cat.id);
    return { ...cat, keywords };
  });

  res.json({ code: 200, message: 'success', data: categoriesWithKeywords });
});

router.post('/categories', (req, res) => {
  const { client_id, category_code, category_name, description, risk_level, suggestion } = req.body;
  
  if (!client_id || !category_code || !category_name) {
    return res.status(400).json({ code: 400, message: '缺少必要参数', data: null });
  }

  const id = db.riskCategory.create(
    client_id, category_code, category_name, 
    description || '', risk_level || 2, suggestion || ''
  );
  
  riskEngine.invalidateCache(client_id);
  res.json({ code: 200, message: '创建成功', data: { id } });
});

router.put('/categories/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { category_name, description, risk_level, suggestion, status, keywords } = req.body;
  
  const category = db.riskCategory.getById(id);
  if (!category) {
    return res.status(404).json({ code: 404, message: '类别不存在', data: null });
  }

  db.riskCategory.update(id, category_name, description, risk_level, suggestion, status);
  
  if (Array.isArray(keywords)) {
    const existingKws = db.riskKeyword.getByCategoryId(id);
    existingKws.forEach(kw => db.riskKeyword.remove(kw.id));
    keywords.forEach(kw => {
      if (kw.keyword && kw.keyword.trim()) {
        db.riskKeyword.create(id, kw.keyword.trim(), kw.match_type || 'contains', kw.weight || 1);
      }
    });
  }
  
  riskEngine.invalidateCache(category.client_id);
  
  const updatedCategory = db.riskCategory.getById(id);
  updatedCategory.keywords = db.riskKeyword.getByCategoryId(id);
  
  res.json({ code: 200, message: '更新成功', data: { category: updatedCategory } });
});

router.delete('/categories/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const category = db.riskCategory.getById(id);
  if (!category) {
    return res.status(404).json({ code: 404, message: '类别不存在', data: null });
  }

  db.riskCategory.remove(id);
  riskEngine.invalidateCache(category.client_id);
  res.json({ code: 200, message: '删除成功', data: null });
});

router.post('/keywords', (req, res) => {
  const { category_id, keyword, match_type, weight } = req.body;
  
  if (!category_id || !keyword) {
    return res.status(400).json({ code: 400, message: '缺少必要参数', data: null });
  }

  const id = db.riskKeyword.create(category_id, keyword, match_type || 'contains', weight || 1);
  
  const category = db.riskCategory.getById(category_id);
  if (category) {
    riskEngine.invalidateCache(category.client_id);
  }
  
  res.json({ code: 200, message: '添加成功', data: { id } });
});

router.delete('/keywords/:id', (req, res) => {
  const id = parseInt(req.params.id);
  
  const kw = db.riskKeyword.getById(id);
  
  db.riskKeyword.remove(id);
  
  if (kw) {
    const category = db.riskCategory.getById(kw.category_id);
    if (category) {
      riskEngine.invalidateCache(category.client_id);
    }
  }
  
  res.json({ code: 200, message: '删除成功', data: null });
});

router.get('/clients/:id/whitelist', (req, res) => {
  const clientId = parseInt(req.params.id);
  const words = db.whitelist.getByClientId(clientId);
  res.json({ code: 200, message: 'success', data: words });
});

router.post('/whitelist', (req, res) => {
  const { client_id, word, word_type, reason, created_by } = req.body;
  
  if (!client_id || !word) {
    return res.status(400).json({ code: 400, message: '缺少必要参数', data: null });
  }

  const id = db.whitelist.create(client_id, word, word_type || 'common', reason || '', created_by || 'admin');
  riskEngine.invalidateCache(client_id);
  res.json({ code: 200, message: '添加成功', data: { id } });
});

router.delete('/whitelist/:id', (req, res) => {
  const id = parseInt(req.params.id);
  
  const item = db.whitelist.getById(id);
  
  db.whitelist.remove(id);
  
  if (item) {
    riskEngine.invalidateCache(item.client_id);
  }
  
  res.json({ code: 200, message: '删除成功', data: null });
});

router.get('/clients/:id/focus-words', (req, res) => {
  const clientId = parseInt(req.params.id);
  const words = db.focusWord.getByClientId(clientId);
  res.json({ code: 200, message: 'success', data: words });
});

router.post('/focus-words', (req, res) => {
  const { client_id, word, focus_level, reason, created_by } = req.body;
  
  if (!client_id || !word) {
    return res.status(400).json({ code: 400, message: '缺少必要参数', data: null });
  }

  const id = db.focusWord.create(client_id, word, focus_level || 1, reason || '', created_by || 'admin');
  riskEngine.invalidateCache(client_id);
  res.json({ code: 200, message: '添加成功', data: { id } });
});

router.delete('/focus-words/:id', (req, res) => {
  const id = parseInt(req.params.id);
  
  const item = db.focusWord.getById(id);
  
  db.focusWord.remove(id);
  
  if (item) {
    riskEngine.invalidateCache(item.client_id);
  }
  
  res.json({ code: 200, message: '删除成功', data: null });
});

module.exports = router;
