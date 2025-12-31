require('dotenv').config();
const { sequelize, Role, Permission, RolePermission, User, UserRole } = require('../src/models');

const PERMS = [
  { code: 'admin.access',   label: 'Access Admin Area' },
  { code: 'repo.upload',    label: 'Upload Resources' },
  { code: 'ann.create',     label: 'Create Announcements' },
  { code: 'don.view',       label: 'View Donations' },
];

const ROLE_DEFS = [
  { name: 'Admin',      description: 'Full admin access',       perms: ['admin.access','repo.upload','ann.create','don.view'] },
  { name: 'Executive',  description: 'Content management',      perms: ['repo.upload','ann.create'] },
  { name: 'Member',     description: 'Basic member',            perms: [] },
];

(async () => {
  try {
    await sequelize.sync({ alter: true });

    for (const p of PERMS) {
      await Permission.findOrCreate({ where: { code: p.code }, defaults: p });
    }

    for (const r of ROLE_DEFS) {
      const [role] = await Role.findOrCreate({ where: { name: r.name }, defaults: { name: r.name, description: r.description } });
      for (const code of r.perms) {
        const perm = await Permission.findOne({ where: { code } });
        if (perm) await RolePermission.findOrCreate({ where: { roleId: role.id, permissionId: perm.id } });
      }
    }

    const admin = await User.findOne({ where: { username: 'admin' } });
    if (admin) {
      const role = await Role.findOne({ where: { name: 'Admin' } });
      if (role) await UserRole.findOrCreate({ where: { userId: admin.id, roleId: role.id } });
      console.log('Admin user has Admin role.');
    }

    console.log('Seeded permissions and roles.');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();