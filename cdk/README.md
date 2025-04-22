# CDK TypeScript deployment project

Deploy the depsysweb website

## Configure
* create config and credentials files in workspace/.aws
* init.sh will link .aws to root homedirectory

## Commands

* `yarn build`   compile typescript to js
* `yarn watch`   watch for changes and compile
* `yarn test`    perform the jest unit tests

* `yarn cdk deploy`  deploy this stack to your default AWS account/region
* `yarn cdk diff`    compare deployed stack with current state
* `yarn cdk synth`   emits the synthesized CloudFormation template
