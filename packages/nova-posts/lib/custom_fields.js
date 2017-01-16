import Users from "meteor/nova:users";

Users.addField([
  /**
    Count of the user's posts
  */
  {
    fieldName: `${Users.prefix}postCount`,
    fieldSchema: {
      type: Number,
      optional: true,
      publish: true,
      defaultValue: 0,
      viewableBy: ['guests'],
    }
  }
]);