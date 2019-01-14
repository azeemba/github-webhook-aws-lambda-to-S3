
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

exports.handler = async (event) => {
  let invalidResponse = githubHelper.validateHookEvent(event);
  if (invalidResponse) {
    return invalidResponse;
  }

  let targetDir = '/tmp/'
  let repoFilesPromise = getAndExtractRepo(process.env.GITHUB_REPO, targetDir);
  let s3FilesPromise = awsHelper.listBucketObjects(process.env.AWS_S3_BUCKET);

  // we triggered the promises in parallel and now we wait till
  // both are done
  let [repoFilenames, s3FilesData] = [
    await repoFilesPromise,
    await s3FilesPromise
  ];

  let repoPublicPrefix = path.join(repoFilenames[0], 'public');
  console.log(repoPublicPrefix);
  let repoPublicFiles = repoFilenames
  .filter(filename => filename.startsWith(repoPublicPrefix))
  .filter(filename => !filename.endsWith('/'))
  .map(
    filename => filename.replace(repoPublicPrefix + '/', '')
  );

  let s3Files = s3FilesData.map(obj => obj.key);

  let inBoth = lodash.intersection(repoPublicFiles, s3Files);
  let missingInS3 = lodash.difference(repoPublicFiles, s3Files);
  let extraInS3 = lodash.difference(s3Files, repoPublicFiles);

  let uploadToS3Objs = s3FilesData.filter(
    obj => inBoth.includes(obj.key) || missingInS3.includes(obj.key)
  );
  let uploadResponses = await awsHelper.uploadToS3(
    process.env.AWS_S3_BUCKET, repoPublicPrefix, uploadToS3Objs);

  let deleteResponses = await awsHelper.deleteFromS3(
    process.env.AWS_S3_BUCKET, extraInS3);

  let distributionId = process.env.AWS_CLOUDFRONT_DISTRIBUTION;
  let cloudFrontResponse;
  if (distributionId) {
    cloudFrontResponse = await awsHelper.resetCloudfrontCache(
      distributionId,
      inBoth.concat(missingInS3).concat(extraInS3));
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
