Deploy to S3 via GitHub Webhook and AWS Lambda
=============

The code here is deployed to AWS Lambda which my personal website's repo
triggers via a GitHub webhook on updates.

The code fetches the latest version of the website repo from GitHub,
sync's the `public/` folder to S3 and optionally creates a
CloudFront invalidation to clear the cache.

## Setup

This project works by setting a GitHub webhook to trigger an API setup using [AWS API Gateway](https://aws.amazon.com/api-gateway/) which simply triggers
an [AWS Lambda].

I created AWS API and Lambda instances manually but the 
[serverless](https://github.com/serverless/serverless)
project has an 
[example](https://github.com/serverless/examples/tree/master/aws-node-github-webhook-listener) 
that may work to automatically configure API and Lambda for you. Once those
are set up, you can copy the rest of the code from here and deploy that.

Here are all the environment variables that need to be defined in the 
AWS Lambda configuration.

- AWS_S3_BUCKET: bucket to sync to
- GITHUB_REPO: The repo where the S3 assets are synced from
- GITHUB_TOKEN: A GitHub [token](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/) for your account
- GITHUB_USER: GitHub username
- GITHUB_WEBHOOK_SECRET: https://developer.github.com/webhooks/securing/
- USER_AGENT: Can be anything, something identifying you our your repo is preferred
- AWS_CLOUDFRONT_DISTRIBUTION: Optional, distribution ID

I bumped up the timeout to be one minute from the default of 3 seconds. On
average my runs are taking about 9 seconds. I kept all other settings
to their default values (including the 128 MB memory).


## Deploy

`export.sh` from this repo can be used as an example for how to deploy
to AWS lambda.

`zip` and `aws` cli tools are required. `aws` CLI can be installed by following
https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html.

`aws` also need to be [configured](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html#cli-quick-configuration) with a user
that is permissioned with full lambda permissions on AWS. 
If you are managing multiple AWS credentials, you can use the [named profiles](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html) features. Otherwise you can skip the `--profile <name>` argument from the
command.

Note: You will have to `npm install` once locally since those dependencies
need to be packaged and deployed to Lambda as well.

## Caveats

- Each build looks at the commits in the webhook and only uploads files that
are modified or added and deletes files that were removed in those commits.
- GitHub webhooks timeout after 10 seconds so its possible that GitHub
  will report a timeout but the build will still continue and succeed.