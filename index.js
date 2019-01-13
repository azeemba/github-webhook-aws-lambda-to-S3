
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const githubHelper = require('github_helper');
const fs = require('fs');

exports.handler = async (event) => {

  let invalidResponse = githubHelper.validateHookEvent(event);
  if (invalidResponse) {
    return invalidResponse;
  }

  // hard code our repo URL instead of trusting incoming request
  let path = '/tmp/azeemba.tar';
  await githubHelper.getRepoArchive(process.env.GITHUB_REPO, path);

  console.log("Exists: ", fs.existsSync(path));

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      input: event,
    }),
  };

  return response;
};
