
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const fs = require('fs');
const path = require('path');

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

exports.uploadToS3 = async function(bucket, localPathPrefix, s3objs) {
    let upload = async function(s3obj) {
        console.log("Uploading", s3obj.key);
        return readFileP(path.join(localPathPrefix, s3obj.key))
        .then(filedata => {
            return s3.putObject({
                Bucket: bucket,
                Key: s3obj.key,
                Body: filedata
            }).promise();
        });
    }
    let promises = s3objs.map(s3obj => {
        return upload(s3obj);
    });
    return Promise.all(promises);
};

exports.deleteFromS3 = async function(bucket, keys) {
    let params = {
        Bucket: bucket,
        Delete: {
            Objects: keys.map(key => ({Key: key}))
        }
    }
    return s3.deleteObjects(params).promise();
};