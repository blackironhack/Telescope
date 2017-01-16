import { Utils } from 'meteor/nova:lib';
import Users from './collection.js';
import moment from 'moment';
import _ from 'underscore';

////////////////////
//  User Getters  //
////////////////////

/**
 * @summary Get a user
 * @param {String} userOrUserId
 */
Users.getUser = function (userOrUserId) {
  if (typeof userOrUserId === "undefined") {
    if (!Meteor.user()) {
      throw new Error();
    } else {
      return Meteor.user();
    }
  } else if (typeof userOrUserId === "string") {
    return Users.findOne(userOrUserId);
  } else {
    return userOrUserId;
  }
};

/**
 * @summary Get a user's username (unique, no special characters or spaces)
 * @param {Object} user
 */
Users.getUserName = function (user) {
  try{
    if (user.username)
      return user.username;
    if (user && user.services && user.services.twitter && user.services.twitter.screenName)
      return user.services.twitter.screenName;
  }
  catch (error){
    console.log(error); // eslint-disable-line
    return null;
  }
};
Users.getUserNameById = function (userId) {return Users.getUserName(Users.findOne(userId))};

/**
 * @summary Get a user's display name (not unique, can take special characters and spaces)
 * @param {Object} user
 */
Users.getDisplayName = function (user) {
  if (typeof user === "undefined") {
    return "";
  } else {
    return (user[`${Users.prefix}displayName`]) ? user[`${Users.prefix}displayName`] : Users.getUserName(user);
  }
};
Users.getDisplayNameById = function (userId) {return Users.getDisplayName(Users.findOne(userId));};

/**
 * @summary Get a user's profile URL
 * @param {Object} user (note: we only actually need either the _id or slug properties)
 * @param {Boolean} isAbsolute
 */
Users.getProfileUrl = function (user, isAbsolute) {
  if (typeof user === "undefined") {
    return "";
  }
  isAbsolute = typeof isAbsolute === "undefined" ? false : isAbsolute; // default to false
  var prefix = isAbsolute ? Utils.getSiteUrl().slice(0,-1) : "";
  if (user[`${Users.prefix}slug`]) {
    return `${prefix}/users/${user[`${Users.prefix}slug`]}`;
  } else {
    return "";
  }
};

/**
 * @summary Get a user's account edit URL
 * @param {Object} user (note: we only actually need either the _id or slug properties)
 * @param {Boolean} isAbsolute
 */
Users.getEditUrl = function (user, isAbsolute) {
  return `${Users.getProfileUrl(user, isAbsolute)}/edit`;
};

/**
 * @summary Get a user's Twitter name
 * @param {Object} user
 */
Users.getTwitterName = function (user) {
  // return twitter name provided by user, or else the one used for twitter login
  if (typeof user !== "undefined") {
    if (Utils.checkNested(user, 'profile', 'twitter')) {
      return user.profile.twitter;
    } else if(Utils.checkNested(user, 'services', 'twitter', 'screenName')) {
      return user.services.twitter.screenName;
    }
  }
  return null;
};
Users.getTwitterNameById = function (userId) {return Users.getTwitterName(Users.findOne(userId));};

/**
 * @summary Get a user's GitHub name
 * @param {Object} user
 */
Users.getGitHubName = function (user) {
  // return twitter name provided by user, or else the one used for twitter login
  if(Utils.checkNested(user, 'profile', 'github')){
    return user.profile.github;
  }else if(Utils.checkNested(user, 'services', 'github', 'screenName')){ // TODO: double-check this with GitHub login
    return user.services.github.screenName;
  }
  return null;
};
Users.getGitHubNameById = function (userId) {return Users.getGitHubName(Users.findOne(userId));};

/**
 * @summary Get a user's email
 * @param {Object} user
 */
Users.getEmail = function (user) {
  if(user[`${Users.prefix}email`]){
    return user[`${Users.prefix}email`];
  }else{
    return null;
  }
};
Users.getEmailById = function (userId) {return Users.getEmail(Users.findOne(userId));};

/**
 * @summary Get a user's email hash
 * @param {Object} user
 */
Users.getEmailHash = function (user) {
  return user[`${Users.prefix}emailHash`];
};
Users.getEmailHashById = function (userId) {return Users.getEmailHash(Users.findOne(userId));};

/**
 * @summary Get a user setting
 * @param {Object} user
 * @param {String} settingName
 * @param {Object} defaultValue
 */
Users.getSetting = function (user = null, settingName, defaultValue = null) {
  // all settings should be prefixed with a prefix to avoid conflict with other meteor packages writing on Meteor.users collection, so add "__" if needed
  settingName = settingName.slice(0, Users.prefix.length) === Users.prefix ? settingName : Users.prefix + settingName;
  if (user) {
    const settingValue = Users.getProperty(user, settingName);
    return typeof settingValue === 'undefined' ? defaultValue : settingValue;
  } else {
    return defaultValue;
  }
};

////////////////////
//  User Checks   //
////////////////////

/**
 * @summary Check if the user has completed their profile.
 * @param {Object} user
 */
Users.hasCompletedProfile = function (user) {
  return _.every(Users.getRequiredFields(), function (fieldName) {
    return !!Utils.getNestedProperty(user, fieldName);
  });
};
Users.hasCompletedProfileById = function (userId) {return Users.hasCompletedProfile(Users.findOne(userId));};

///////////////////
// Other Helpers //
///////////////////

Users.findLast = function (user, collection) {
  return collection.findOne({userId: user._id}, {sort: {createdAt: -1}});
};

Users.timeSinceLast = function (user, collection){
  var now = new Date().getTime();
  var last = this.findLast(user, collection);
  if(!last)
    return 999; // if this is the user's first post or comment ever, stop here
  return Math.abs(Math.floor((now-last.createdAt)/1000));
};

Users.numberOfItemsInPast24Hours = function (user, collection) {
  var mNow = moment();
  var items = collection.find({
    userId: user._id,
    createdAt: {
      $gte: mNow.subtract(24, 'hours').toDate()
    }
  });
  return items.count();
};

Users.getProperty = function (object, property) {
  // recursive function to get nested properties
  var array = property.split('.');
  if(array.length > 1){
    var parent = array.shift();
    // if our property is not at this level, call function again one level deeper if we can go deeper, else return undefined
    return (typeof object[parent] === "undefined") ? undefined : this.getProperty(object[parent], array.join('.'));
  }else{
    // else return property
    return object[array[0]];
  }
};

Users.setSetting = (user, settingName, value) => {
  // all users settings should begin with a prefix, so add it if needed
  var field = settingName.slice(0, Users.prefix.length) === Users.prefix ? settingName : Users.prefix + settingName;

  var modifier = {$set: {}};
  modifier.$set[field] = value;

  Users.update(user._id, modifier);
}


////////////////////
// More Helpers   //
////////////////////

// helpers that don't take a user as argument

/**
 * @summary @method Users.getRequiredFields
 * Get a list of all fields required for a profile to be complete.
 */
Users.getRequiredFields = function () {
  var schema = Utils.stripTelescopeNamespace(Users.simpleSchema()._schema);
  var fields = _.filter(_.keys(schema), function (fieldName) {
    var field = schema[fieldName];
    return !!field.required;
  });
  return fields;
};

/**
 * @summary @method Users.getPreloadedFields
 * Get a list of all fields that need to be preloaded for the current user
 */
Users.getPreloadedFields = function () {
  // this = collection Users with the final (= extended) schema attached
  const preloadedFields = _.compact(_.map(this.simpleSchema()._schema, (field, fieldName) => {
    return field.preload ? fieldName : undefined;
  }));
  return preloadedFields;
};

Users.adminUsers = function (options) {
  return this.find({isAdmin : true}, options).fetch();
};

Users.getCurrentUserEmail = function () {
  return Meteor.user() ? Users.getEmail(Meteor.user()) : '';
};

Users.findByEmail = function (email) {
  return Users.findOne({[`${Users.prefix}email`]: email});
};
