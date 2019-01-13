
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

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