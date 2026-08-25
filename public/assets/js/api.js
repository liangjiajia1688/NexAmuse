// NexAmuse 前端 API 封装（全局 window.Api）
window.Api = (function () {
  const BASE = '/api';

  function token() { return localStorage.getItem('na_token'); }

  function headers(needAuth) {
    const h = { 'Content-Type': 'application/json' };
    if (needAuth && token()) h['Authorization'] = 'Bearer ' + token();
    return h;
  }

  async function call(path, method, body, needAuth) {
    const opt = { method, headers: headers(needAuth) };
    if (body !== undefined) opt.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opt);
    let data = {};
    try { data = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok) throw new Error(data.error || ('请求失败 (' + res.status + ')'));
    return data;
  }

  return {
    register: (d) => call('/register', 'POST', d, false),
    login: (d) => call('/login', 'POST', d, false),
    me: () => call('/me', 'GET', undefined, true),
    products: (q) => call('/products' + (q || ''), 'GET'),
    createProduct: (d) => call('/products', 'POST', d, true),
    product: (id) => call('/products/' + id, 'GET'),
    companies: (q) => call('/companies' + (q || ''), 'GET'),
    createCompany: (d) => call('/companies', 'POST', d, true),
    company: (id) => call('/companies/' + id, 'GET'),
    forum: (q) => call('/forum' + (q || ''), 'GET'),
    createPost: (d) => call('/forum', 'POST', d, true),
    post: (id) => call('/forum/' + id, 'GET'),
    reply: (id, d) => call('/forum/' + id, 'POST', d, true),
    upload: (img) => call('/upload', 'POST', { image: img }, true),
    news: (q) => call('/news' + (q || ''), 'GET'),
    my: (type) => call('/my?type=' + (type || 'products'), 'GET', undefined, true),
  };
})();
