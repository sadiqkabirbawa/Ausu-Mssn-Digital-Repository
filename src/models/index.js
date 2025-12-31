const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'mssn_repo',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    dialect: process.env.DB_DIALECT || 'sqlite',
    storage: process.env.DB_STORAGE || './dev.sqlite3',
    logging: false,
    dialectOptions: process.env.DB_DIALECT === 'mysql' ? { charset: 'utf8mb4' } : {}
  }
);

const User = require('./user')(sequelize, DataTypes);
const ResourceCategory = require('./resourceCategory')(sequelize, DataTypes);
const Resource = require('./resource')(sequelize, DataTypes);
const Announcement = require('./announcement')(sequelize, DataTypes);
const Donation = require('./donation')(sequelize, DataTypes);
const EmailVerification = require('./emailVerification')(sequelize, DataTypes);
const Analytics = require('./analytics')(sequelize, DataTypes);
const Notification = require('./notification')(sequelize, DataTypes);

const Role = require('./role')(sequelize, DataTypes);
const Permission = require('./permission')(sequelize, DataTypes);
const RolePermission = require('./rolePermission')(sequelize, DataTypes);
const UserRole = require('./userRole')(sequelize, DataTypes);

Resource.belongsTo(ResourceCategory, { foreignKey: 'categoryId' });
ResourceCategory.hasMany(Resource, { foreignKey: 'categoryId' });

Resource.belongsTo(User, { foreignKey: 'uploaderId' });
User.hasMany(Resource, { foreignKey: 'uploaderId' });

Announcement.belongsTo(User, { foreignKey: 'authorId' });
User.hasMany(Announcement, { foreignKey: 'authorId' });

User.belongsToMany(Role, { through: UserRole, foreignKey: 'userId' });
Role.belongsToMany(User, { through: UserRole, foreignKey: 'roleId' });

Role.belongsToMany(Permission, { through: { model: RolePermission, unique: false }, foreignKey: 'roleId', otherKey: 'permissionId' });
Permission.belongsToMany(Role, { through: { model: RolePermission, unique: false }, foreignKey: 'permissionId', otherKey: 'roleId' });

EmailVerification.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(EmailVerification, { foreignKey: 'userId' });

Analytics.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Analytics, { foreignKey: 'userId' });

Analytics.belongsTo(Resource, { foreignKey: 'resourceId' });
Resource.hasMany(Analytics, { foreignKey: 'resourceId' });

Notification.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Notification, { foreignKey: 'userId' });

module.exports = {
  sequelize,
  User, ResourceCategory, Resource, Announcement, Donation, EmailVerification, Analytics, Notification,
  Role, Permission, RolePermission, UserRole
};