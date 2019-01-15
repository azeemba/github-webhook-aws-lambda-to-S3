
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const cloudfront = new AWS.CloudFront();
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const {promisify} = require('util');
const readFileP = promisify(fs.readFile);

function makeFileDatas(s3Contents) {
    return s3Contents.map(content => ({
        key: content.Key,
        lastModified: content.LastModified,
        etag: content.ETag,
        size: content.Size
    }));
}

exports.listBucketObjects = async function(bucket) {
    let params = {
        Bucket: bucket,
    }

    let objects = await s3.listObjectsV2(params).promise();
    let results = makeFileDatas(objects.Contents)
    while (objects.IsTruncated) {
        objects = await s3.listObjectsV2(params).promise();
        results = results.concat(makeFileDatas(objects.Contents));
    }

    return results;
}

exports.uploadToS3 = async function(bucket, localPathPrefix, keys) {
    let upload = async function(key) {
        console.log("Uploading ", key);
        return readFileP(path.join(localPathPrefix, key))
        .then(filedata => {
            return s3.putObject({
                Bucket: bucket,
                Key: key,
                Body: filedata,
                ContentType: mime.lookup(key) || 'application/octet-stream',
                ACL: 'public-read'
            }).promise();
        });
    }
    let promises = keys.map(key => {
        return upload(key);
    });
    return Promise.all(promises);
};

exports.deleteFromS3 = async function(bucket, keys) {
    if (keys.length == 0) {
        return;
    }
    let deleteKeys = keys.map(key => ({Key: key}));
    console.log("Deleting: ", deleteKeys);
    let params = {
        Bucket: bucket,
        Delete: {
            Objects: deleteKeys
        }
    }
    return s3.deleteObjects(params).promise();
};

exports.resetCloudfrontCache = async function(distributionId) {
    var params = {
        DistributionId: distributionId,
        InvalidationBatch: {
            CallerReference: Date.now().toString(),
            Paths: {
                Quantity: 1,
                Items: [ '/*' ]
            }
        }
    };
    console.log("Resetting cloudfront cache", params);
    return cloudfront.createInvalidation(params).promise()
};