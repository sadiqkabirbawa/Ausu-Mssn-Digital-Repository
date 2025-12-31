const express = require('express');
const layoutHook = require('../views/_layout_hook');
const { requireAdmin } = require('../middleware/admin');
const { requirePerm } = require('../middleware/perm');
const {
  User, ResourceCategory, Resource, Announcement, Donation,
  Role, UserRole, Analytics
} = require('../models');
const analyticsService = require('../services/analyticsService');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

const router = express.Router();
router.use(layoutHook);
router.use(requireAdmin);
router.use(requirePerm('admin.access'));

router.get('/', async (req, res) => {
  const [users, resources, announcements, donations] = await Promise.all([
    User.count(), Resource.count(), Announcement.count(),
    Donation.count({ where: { status: 'SUCCESS' } })
  ]);
  
  const [latestDonations, analytics] = await Promise.all([
    Donation.findAll({
      where: { status: 'SUCCESS' },
      order: [['createdAt','DESC']],
      limit: 10
    }),
    analyticsService.getDashboardStats()
  ]);
  
  res.render('admin/dashboard', {
    title: 'Admin Dashboard',
    totals: { users, resources, announcements, donations },
    latestDonations,
    analytics
  });
});

router.get('/users', async (req, res) => {
  const q = req.query.q || '';
  const where = q
    ? {
        [Op.or]: [
          { username:  { [Op.like]: `%${q}%` } },
          { email:     { [Op.like]: `%${q}%` } },
          { firstName: { [Op.like]: `%${q}%` } },
          { lastName:  { [Op.like]: `%${q}%` } },
        ]
      }
    : {};

  const [users, roles] = await Promise.all([
    User.findAll({ where, order: [['createdAt','DESC']], limit: 200 }),
    Role.findAll({ order: [['name','ASC']] })
  ]);

  res.render('admin/users/list', { title: 'Users', users, q, roles });
});

router.get('/users/new', async (req, res) => {
  const roles = await Role.findAll({ order: [['name','ASC']] });
  res.render('admin/users/new', { title: 'Onboard New User', roles });
});

router.post('/users/create', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role } = req.body;

    let roles = req.body.roles || [];
    if (!Array.isArray(roles)) roles = [roles].filter(Boolean);

    if (!username || !email || !password) {
      req.flash('error', 'Username, Email, and Password are required.');
      return res.redirect(req.header('Referer') || '/admin/users/new');
    }

    const exists = await User.findOne({
      where: { [Op.or]: [{ username }, { email }] }
    });
    if (exists) {
      req.flash('error', 'Username or Email already exists.');
      return res.redirect(req.header('Referer') || '/admin/users/new');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      passwordHash,
      firstName: firstName || '',
      lastName: lastName || '',
      role: role || 'MEMBER',
      isSuperuser: false,
    });

    if (roles.length) {
      const roleRows = await Role.findAll({ where: { id: roles } });
      for (const r of roleRows) {
        await UserRole.findOrCreate({ where: { userId: user.id, roleId: r.id } });
      }
    }

    req.flash('success', `User "${username}" created successfully.`);
    return res.redirect('/admin/users');
  } catch (e) {
    console.error('Onboard user error:', e);
    req.flash('error', 'Failed to create user.');
    return res.redirect(req.header('Referer') || '/admin/users/new');
  }
});

router.post('/users/:id/role', async (req, res) => {
  try {
    const u = await User.findByPk(req.params.id);
    if (u) {
      await u.update({ role: req.body.role || 'MEMBER' });
      req.flash('success','Role updated.');
    }
  } catch (e) { console.error(e); req.flash('error','Failed.'); }
  res.redirect('/admin/users');
});

router.post('/users/:id/password', async (req, res) => {
  try {
    const u = await User.findByPk(req.params.id);
    if (u) {
      u.passwordHash = await bcrypt.hash(req.body.password || 'admin1234', 10);
      await u.save();
      req.flash('success','Password reset.');
    }
  } catch (e) { console.error(e); req.flash('error','Failed.'); }
  res.redirect('/admin/users');
});

router.post('/users/:id/delete', async (req, res) => {
  try {
    await User.destroy({ where: { id: req.params.id } });
    req.flash('success','User deleted.');
  } catch (e) { console.error(e); req.flash('error','Failed.'); }
  res.redirect('/admin/users');
});

router.get('/categories', async (req, res) => {
  const categories = await ResourceCategory.findAll({ order: [['name','ASC']] });
  res.render('admin/categories/list', { title: 'Categories', categories });
});
router.post('/categories/create', async (req, res) => {
  try {
    await ResourceCategory.create({ name: req.body.name, slug: req.body.slug });
    req.flash('success','Category created.');
  } catch { req.flash('error','Failed.'); }
  res.redirect('/admin/categories');
});
router.post('/categories/:id/delete', async (req, res) => {
  try {
    await ResourceCategory.destroy({ where: { id: req.params.id } });
    req.flash('success','Category deleted.');
  } catch { req.flash('error','Failed.'); }
  res.redirect('/admin/categories');
});

router.get('/resources', async (req, res) => {
  const resources = await Resource.findAll({ order: [['createdAt','DESC']], include: [ResourceCategory] });
  res.render('admin/resources/list', { title: 'Resources', resources });
});
router.post('/resources/:id/delete', async (req, res) => {
  try {
    await Resource.destroy({ where: { id: req.params.id } });
    req.flash('success','Resource deleted.');
  } catch { req.flash('error','Failed.'); }
    res.redirect('/admin/resources');
});

router.get('/announcements', async (req, res) => {
  const announcements = await Announcement.findAll({ order: [['createdAt','DESC']] });
  res.render('admin/announcements/list', { title: 'Announcements', announcements });
});
router.post('/announcements/create', async (req, res) => {
  try {
    await Announcement.create({
      title: req.body.title,
      body: req.body.body,
      isPublic: !!req.body.isPublic,
      authorId: res.locals.currentUser.id
    });
    req.flash('success','Announcement published.');
  } catch { req.flash('error','Failed.'); }
  res.redirect('/admin/announcements');
});
router.post('/announcements/:id/delete', async (req, res) => {
  try {
    await Announcement.destroy({ where: { id: req.params.id } });
    req.flash('success','Announcement deleted.');
  } catch { req.flash('error','Failed.'); }
  res.redirect('/admin/announcements');
});

router.get('/donations', async (req, res) => {
  const donations = await Donation.findAll({ order: [['createdAt','DESC']] });
  res.render('admin/donations/list', { title: 'Donations', donations });
});
router.get('/donations/export.csv', async (req, res) => {
  const donations = await Donation.findAll({ order: [['createdAt','DESC']] });
  const rows = [['Full Name','Email','Amount','Status','Reference','Created At']].concat(
    donations.map(d => [d.fullName, d.email, d.amount, d.status, d.reference, d.createdAt.toISOString()])
  );
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename="donations.csv"');
  res.send(rows.map(r => r.map(v => `"${String(v).replace('"','""')}"`).join(',')).join('\n'));
});

module.exports = router;