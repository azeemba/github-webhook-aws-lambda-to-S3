
const fs = require('fs');
const path = require('path');
const lodash = require('lodash');
const { exec } = require('child_process');

const githubHelper = require('github_helper');
const awsHelper = require('aws_helper');

const {promisify} = require('util');
const rmdirP = promisify(fs.rmdir);
const statP = promisify(fs.stat);
const execP = promisify(exec);

process.env.PATH = process.env.PATH + ':' + path.resolve('.', 'bin');

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
  let uploadResponses = awsHelper.uploadToS3(
    process.env.AWS_S3_BUCKET, repoPublicPrefix, uploadToS3Keys);

  let deleteResponses = awsHelper.deleteFromS3(
    process.env.AWS_S3_BUCKET, deletedFiles);

  let distributionId = process.env.AWS_CLOUDFRONT_DISTRIBUTION;
  let cloudFrontResponse;
  if (distributionId) {
    cloudFrontResponse = awsHelper.resetCloudfrontCache(
      distributionId);
  }

  if (process.env.REGEN_PUBLIC_CMD) {
    let cmd = process.env.REGEN_PUBLIC_CMD;
    let output = await execP(cmd, {cwd: targetDir});
    console.log(cmd, output);
    if (!(await githubHelper.isClean(targetDir))) {
      await githubHelper.commitAndPushPublic(targetDir);
    }
  }

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      upload: await uploadResponses,
      delete: await deleteResponses,
      cloudFront: await cloudFrontResponse
    })
  };

  return response;
};
