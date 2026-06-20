const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const reportRoutes = require('./routes/report');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/v1', apiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/report', reportRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'danmaku-risk-screening'
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    code: 500,
    message: '服务器内部错误',
    data: null
  });
});

app.listen(PORT, () => {
  console.log(`弹幕风险筛查服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`管理后台: http://localhost:${PORT}/admin.html`);
  console.log(`月度报告: http://localhost:${PORT}/report.html`);
  console.log(`API 文档:`);
  console.log(`  - 弹幕筛查: POST /api/v1/screen`);
  console.log(`  - 误报反馈: POST /api/v1/feedback`);
  console.log(`  - 健康检查: GET /health`);
});

module.exports = app;
