import Ember from 'ember';
import DS from 'ember-data';

let roleUrlRegex = new RegExp('/roles/([a-zA-Z0-9\-]+)$');

function getRoleIdFromPermission(permission){
  var roleUrl = permission.get('data.links.role');
  return roleUrlRegex.exec(roleUrl)[1];
}

export default DS.Model.extend({
  // properties
  name: DS.attr('string'),
  handle: DS.attr('string'),
  number: DS.attr('string'),
  type: DS.attr('string'),
  syslogHost: DS.attr('string'),
  syslogPort: DS.attr('string'),
  organizationUrl: DS.attr('string'),
  activated: DS.attr('boolean'),

  // relationships
  apps: DS.hasMany('app', {async: true}),
  databases: DS.hasMany('database', {async: true}),
  permissions: DS.hasMany('permission', {async:true}),
  organization: DS.belongsTo('organization', {async:true}),
  logDrains: DS.hasMany('log-drain', {async:true}),

  // computed properties
  allowPHI: Ember.computed.match('type', /production/),
  appContainerCentsPerHour: Ember.computed('allowPHI', function() {
    return this.get('allowPHI') ? 10 : 6;
  }),

  permitsRole(role, scope){
    let permissions;

    if (role.get('privileged') &&
        role.get('data.links.organization') === this.get('data.links.organization')) {
      return new Ember.RSVP.Promise((resolve) => {
        resolve(true);
      });
    }

    return this.get('permissions').then(function(_permissions){
      permissions = _permissions;

      return permissions.map(function(perm){
        return {
          roleId: getRoleIdFromPermission(perm),
          scope:  perm.get('scope')
        };
      });
    }).then(function(stackRoleScopes){
      return Ember.A(Ember.A(stackRoleScopes).filter((stackRoleScope) => {
        return role.get('id') === stackRoleScope.roleId;
      })).any((stackRoleScope) => {
        return stackRoleScope.scope === 'manage' ||
          stackRoleScope.scope === scope;
      });
    });
  }
});
