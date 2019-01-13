
const fs = require('fs');
const path = require('path');
const lodash = require('lodash');

const githubHelper = require('github_helper');
const awsHelper = require('aws_helper');

const {promisify} = require('util');
const rmdirP = promisify(fs.rmdir);
const statP = promisify(fs.stat);

async function getAndExtractRepo(repo, targetDir) {
  // hard code our repo URL instead of trusting incoming request
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
  let s3FilesPromise = awsHelper.listBucketObjects(process.env['AWS_S3_BUCKET']);

  // we triggered the promises in parallel and now we wait till
  // both are done
  let [repoFilenames, s3FilesData] = [
    await repoFilesPromise,
    await s3FilesPromise
  ];

  let publicDirectoryRegex = new RegExp(`${targetDir}[^/]*/public/`);
  let repoPublicPrefix = path.join(repoFilenames[0], 'public');
  console.log(repoPublicPrefix);
  let repoPublicFiles = repoFilenames
  .filter(filename => publicDirectoryRegex.test(filename))
  .filter(filename => !filename.endsWith('/'))
  .map(
    filename => filename.replace(publicDirectoryRegex, '')
  );

  let s3Files = s3FilesData.map(obj => obj.key);

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      missingInS3: lodash.difference(repoPublicFiles, s3Files),
      extrainS3: lodash.difference(s3Files, repoPublicFiles)
    })
  };

  return response;
};
