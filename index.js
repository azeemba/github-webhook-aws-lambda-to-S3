
const fs = require('fs');
const path = require('path');
const lodash = require('lodash');

const githubHelper = require('github_helper');
const awsHelper = require('aws_helper');

const {promisify} = require('util');
const rmdirP = promisify(fs.rmdir);
const statP = promisify(fs.stat);

async function getAndExtractRepo(repo, targetDir) {
  let path = '/tmp/azeemba.tar';
  let hash = await githubHelper.getRepoArchive(repo, path);

  let filesList = await githubHelper.extractRepoArchive(path, targetDir);

  return filesList;
}

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

exports.handler = async (event) => {
  let invalidResponse = githubHelper.validateHookEvent(event);
  if (invalidResponse) {
    return invalidResponse;
  }

  let commits = JSON.parse(event.body).commits;
  let addedFiles = getTypeFromCommits(commits, "added")
  let modifiedFiles = getTypeFromCommits(commits, "modified");
  let deletedFiles = getTypeFromCommits(commits, "removed");

  let targetDir = '/tmp/'
  let repoFilenames = await getAndExtractRepo(process.env.GITHUB_REPO, targetDir);
//  let s3FilesPromise = awsHelper.listBucketObjects(process.env.AWS_S3_BUCKET);

  // we triggered the promises in parallel and now we wait till
  // both are done
  // let [repoFilenames, s3FilesData] = [
  //   await repoFilesPromise,
  //   await s3FilesPromise
  // ];

  let repoPublicPrefix = path.join(repoFilenames[0], 'public');

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
