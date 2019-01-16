
const fs = require('fs');
const path = require('path');
const lodash = require('lodash');

const githubHelper = require('github_helper');
const awsHelper = require('aws_helper');

const {promisify} = require('util');
const rmdirP = promisify(fs.rmdir);
const statP = promisify(fs.stat);

process.env.PATH = process.env.PATH + ':' + path.resolve('.', 'bin');
process.env.GIT_EXEC_PATH = path.resolve('.', 'bin', 'libexec', 'git-core');

function getTypeFromCommits(commits, type) {
  return (
    lodash.flatten(
      commits.map( c => c[type])
    ).filter(
      f => f.startsWith('public/')
    ).map(
      f => f.replace("public/", "")
    )
  );
}

exports.handler = async (event, context) => {
  let invalidResponse = githubHelper.validateHookEvent(event);
  if (invalidResponse) {
    return invalidResponse;
  }

  let commits = JSON.parse(event.body).commits;
  let addedFiles = getTypeFromCommits(commits, "added")
  let modifiedFiles = getTypeFromCommits(commits, "modified");
  let deletedFiles = getTypeFromCommits(commits, "removed");

  let targetDir = `/tmp/${context.awsRequestId}`;
  let user = process.env.GITHUB_USER;
  let token = process.env.GITHUB_TOKEN;
  let repo = process.env.GITHUB_REPO;
  await githubHelper.getRepo(repo, user, token, targetDir);

  let repoPublicPrefix = path.join(targetDir, 'public');

  let uploadToS3Keys= addedFiles.concat(modifiedFiles);
  let uploadResponses = await awsHelper.uploadToS3(
    process.env.AWS_S3_BUCKET, repoPublicPrefix, uploadToS3Keys);

  let deleteResponses = await awsHelper.deleteFromS3(
    process.env.AWS_S3_BUCKET, deletedFiles);

  let distributionId = process.env.AWS_CLOUDFRONT_DISTRIBUTION;
  let cloudFrontResponse;
  if (distributionId) {
    cloudFrontResponse = await awsHelper.resetCloudfrontCache(
      distributionId);
  }

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      uploadResponses,
      deleteResponses,
      cloudFrontResponse
    })
  };

  return response;
};
