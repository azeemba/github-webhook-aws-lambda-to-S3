
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const githubHelper = require('github_helper');

exports.handler = async (event) => {

  let invalidResponse = githubHelper.validateHookEvent(event);
  if (invalidResponse) {
    return invalidResponse;
  }

  // Do custom stuff here with github event data
  // For more on events see https://developer.github.com/v3/activity/events/types/

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      input: event,
    }),
  };

  return response;
};
