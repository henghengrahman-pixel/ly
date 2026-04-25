require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;
const DATA_DIR = path.resolve(BASE_DIR, process.env.DATA_DIR || 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const ADMIN_ID = process.env.ADMIN_ID || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-now';

const DEFAULT_CONFIG = {
  siteTitle: 'CUSTOMER SERVICE OMTOGEL',
  profileAlt: 'CS OMTOGEL',
  profilePhoto: 'https://i.postimg.cc/DZM5NWbq/omcs.png',
  backgroundDesktop: '',
  backgroundMobile: '',
  wa1: 'https://wa.me/6280000000001',
  wa2: 'https://wa.me/6280000000002',
  wa3: 'https://wa.me/6280000000003',
  tg1: 'https://t.me/username1',
  tg2: 'https://t.me/username2',
  lc1: '#',
  lc2: '#'
};

function clean(value) {
  return String(value || '').trim();
}

async function ensureConfig() {
  await fs.ensureDir(DATA_DIR);
  if (!(await fs.pathExists(CONFIG_FILE))) {
    await fs.writeJson(CONFIG_FILE, DEFAULT_CONFIG, { spaces: 2 });
  }
}

async function readConfig() {
  await ensureConfig();
  const data = await fs.readJson(CONFIG_FILE).catch(() => ({}));
  return { ...DEFAULT_CONFIG, ...data };
}

async function saveConfig(body) {
  const next = {};
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    next[key] = clean(body[key]);
  }
  await fs.writeJson(CONFIG_FILE, next, { spaces: 2 });
  return next;
}

function requireLogin(req, res, next) {
  if (req.session && req.session.isAdmin === true) return next();
  return res.redirect('/admin/login');
}

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(BASE_DIR, 'views'));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(BASE_DIR, 'public'), { maxAge: '7d' }));
app.use(session({
  name: 'livechat.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 12
  }
}));

app.get('/', async (req, res, next) => {
  try {
    const config = await readConfig();
    res.render('index', { config });
  } catch (err) {
    next(err);
  }
});

app.get('/admin', requireLogin, async (req, res, next) => {
  try {
    const config = await readConfig();
    res.render('dashboard', { config, success: req.query.success === '1', error: '' });
  } catch (err) {
    next(err);
  }
});

app.get('/admin/login', (req, res) => {
  if (req.session && req.session.isAdmin === true) return res.redirect('/admin');
  res.render('login', { error: '' });
});

app.post('/admin/login', (req, res) => {
  const userId = clean(req.body.userId);
  const password = clean(req.body.password);
  if (userId === ADMIN_ID && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  return res.status(401).render('login', { error: 'User ID atau password salah.' });
});

app.post('/admin/save', requireLogin, async (req, res, next) => {
  try {
    await saveConfig(req.body);
    res.redirect('/admin?success=1');
  } catch (err) {
    next(err);
  }
});

app.post('/admin/logout', requireLogin, (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

app.use((req, res) => {
  res.status(404).send('404 - Halaman tidak ditemukan');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('500 - Server error. Cek log Railway.');
});

ensureConfig().then(() => {
  app.listen(PORT, () => console.log(`RUNNING ON PORT ${PORT}`));
}).catch((err) => {
  console.error('Gagal membuat data dir:', err);
  process.exit(1);
});
