import Ember from "ember";
import storage from '../utils/storage';
import config from "../config/environment";
import JWT from '../utils/jwt';
import { auth } from '../adapters/application';

function clearSession(){
  delete auth.token;
  storage.remove(config.authTokenKey);
}

function persistSession(accessToken){
  auth.token = accessToken;
  storage.write(config.authTokenKey, accessToken);
}

export default Ember.Object.extend({
  analytics: Ember.inject.service(),
  fetch: function(){
    var store = this.store;
    return new Ember.RSVP.Promise(function(resolve){
      var token = storage.read(config.authTokenKey);

      if (!token) {
        throw new Error('Token not found');
      }

      auth.token = token;
      var jwt = JWT.create({token:token});

      var jwtPayload = jwt.get('payload');
      resolve(store.push('token', {
        id: jwtPayload.id,
        accessToken: token,
        links: {
          user: jwtPayload.sub
        }
      }));
    }).then((token) => {
      const user = token.get('user');
      return Ember.RSVP.hash({
        currentUser: user
      });
    }).then((session) => {
      this.identifyToAnalytics(session.currentUser);
      return session;
    }).catch(function(e){
      clearSession();
      throw e;
    });
  },

  open: function(tokenPayload){
    var store = this.store;
    return new Ember.RSVP.Promise(function(resolve){
      resolve(store.push('token', {
        id: tokenPayload.id,
        accessToken: tokenPayload.access_token,
        links: {
          user: tokenPayload._links.user.href
        }
      }));
    }).then((token) => {
      var accessToken = token.get('accessToken');
      persistSession(accessToken);

      return Ember.RSVP.hash({
        currentUser: token.get('user')
      });
    }).then((session) => {
      const user = session.currentUser;
      this.identifyToAnalytics(user);

      return session;
    }).catch(function(e){
      clearSession();
      throw e;
    });
  },

  close: function(){
    return new Ember.RSVP.Promise(function(resolve){
      clearSession();
      resolve();
    });
  },

  identifyToAnalytics(user) {
    const email = user.get('email');
    this.get('analytics').identify(user.get('id'), {
      email: email,
      id: user.get('id'),
      name: user.get('name'),
      createdAt: user.get('createdAt')
    });
  }

});
