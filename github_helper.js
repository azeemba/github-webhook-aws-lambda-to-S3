
// adapted from 
// https://github.com/serverless/examples/blob/master/aws-node-github-webhook-listener/handler.js
const crypto = require('crypto');

function signRequestBody(key, body) {
  return `sha1=${crypto.createHmac('sha1', key).update(body, 'utf-8').digest('hex')}`;
}

exports.validateHookEvent = function(event) {
  let errMsg; // eslint-disable-line
  const token = process.env.GITHUB_WEBHOOK_SECRET;
  const headers = event.headers;
  const sig = headers['X-Hub-Signature'];
  const githubEvent = headers['X-GitHub-Event'];
  const id = headers['X-GitHub-Delivery'];
  const calculatedSig = signRequestBody(token, event.body);

  if (typeof token !== 'string') {
    errMsg = 'Must provide a \'GITHUB_WEBHOOK_SECRET\' env variable';
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    };
  }

  if (!sig) {
    errMsg = 'No X-Hub-Signature found on request';
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    };
  }

  if (!githubEvent) {
    errMsg = 'No X-Github-Event found on request';
    return {
      statusCode: 422,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    };
  }

  if (!id) {
    errMsg = 'No X-Github-Delivery found on request';
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    };
  }

  if (sig !== calculatedSig) {
    errMsg = 'X-Hub-Signature incorrect. Github webhook token doesn\'t match';
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    };
  }
  
  /* eslint-disable */
  console.log('---------------------------------');
  console.log(`Github-Event: "${githubEvent}" with action: "${event.body.action}"`);
  console.log('---------------------------------');
  console.log('Payload', event.body);
  /* eslint-enable */

  return;
};