const http = require('http');
http.get('http://localhost:3000/api/admin/clients', (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', d.substring(0, 1000));
    try {
      const parsed = JSON.parse(d);
      console.log('\nParsed data:', Object.keys(parsed));
      if (parsed.data) {
        console.log('data is:', typeof parsed.data, Array.isArray(parsed.data) ? `array[${parsed.data.length}]` : '');
      }
    } catch(e) {
      console.log('Parse error:', e.message);
    }
  });
});
