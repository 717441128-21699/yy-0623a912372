const http = require('http');

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  try {
    // 保存调试历史
    const res = await request('/api/admin/debug-history', 'POST', {
      client_id: 1,
      input_danmakus: ['测试弹幕1', '测试弹幕2'],
      results: [{ content: '测试弹幕1', result: { is_risky: false } }],
      remark: '测试'
    });
    console.log('保存调试历史状态:', res.status);
    console.log('返回 body:', JSON.stringify(res.body, null, 2));
    console.log('data.id:', res.body && res.body.data && res.body.data.id);
    console.log('data.record:', res.body && res.body.data && res.body.data.record);
  } catch (e) {
    console.error(e);
  }
})();
