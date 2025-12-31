require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet');
const csrf = require('csurf');
const { sequelize } = require('./src/models');
const { attachUserToLocals } = require('./src/middleware/auth');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('views', path.join(__dirname, 'src/views'));
app.set('view engine', 'ejs');

app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true },
  })
);
app.use(flash());

const csrfProtection = csrf();
app.use((req, res, next) => {
  const csrfExemptPaths = [
    '/donations/webhook', 
    '/repository/upload',
    '/notifications/unread-count',
    // Mark-as-read actions can be AJAX; rely on auth and method checks
    '/notifications/mark-all-read'
  ];
  if (csrfExemptPaths.includes(req.path)) return next();
  return csrfProtection(req, res, next);
});
app.use((req, res, next) => {
  res.locals.csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : '';
  next();
});

app.use(attachUserToLocals);

// routes
const indexRoutes = require('./src/routes/index');
const authRoutes = require('./src/routes/auth');
const repoRoutes = require('./src/routes/repository');
const annRoutes = require('./src/routes/announcements');
const donationRoutes = require('./src/routes/donations');
const adminRoutes = require('./src/routes/admin');
const adminRBACRoutes = require('./src/routes/admin_rbac');
const profileRoutes = require('./src/routes/profile');

function assertRouter(name, r) {
  if (typeof r !== 'function') {
    console.error(`[FATAL] ${name} exported a ${typeof r}. Expected an Express router function. Ensure "module.exports = router" in that file.`);
    process.exit(1);
  }
}
assertRouter('indexRoutes', indexRoutes);
assertRouter('authRoutes', authRoutes);
assertRouter('repoRoutes', repoRoutes);
assertRouter('annRoutes', annRoutes);
assertRouter('donationRoutes', donationRoutes);
assertRouter('adminRoutes', adminRoutes);
assertRouter('adminRBACRoutes', adminRBACRoutes);
assertRouter('profileRoutes', profileRoutes);

app.use('/', indexRoutes);
app.use('/accounts', authRoutes);
app.use('/repository', repoRoutes);
app.use('/announcements', annRoutes);
app.use('/donations', donationRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/rbac', adminRBACRoutes);
app.use('/notifications', require('./src/routes/notifications'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  req.flash('error', 'An unexpected error occurred.');
  res.redirect('/');
});

const BASE_PORT = Number(process.env.PORT) || 3000;

async function startServerWithRetry(startPort, maxRetries = 5) {
  await sequelize.authenticate();
  console.log('DB connected.');
  await sequelize.sync();

  let currentPort = startPort;
  let attempts = 0;

  return new Promise((resolve, reject) => {
    const listen = () => {
      const server = app
        .listen(currentPort, () => {
          console.log(`Server running at http://127.0.0.1:${currentPort}`);
          resolve(server);
        })
        .on('error', (err) => {
          if (err && err.code === 'EADDRINUSE' && attempts < maxRetries) {
            attempts += 1;
            currentPort += 1;
            console.warn(
              `Port in use. Retrying on ${currentPort} (attempt ${attempts}/${maxRetries})...`
            );
            setTimeout(listen, 300);
            return;
          }
          reject(err);
        });
    };
    listen();
  });
}

(async () => {
  try {
    await startServerWithRetry(BASE_PORT);
  } catch (e) {
    console.error('Failed to start:', e);
    process.exit(1);
  }
})();
