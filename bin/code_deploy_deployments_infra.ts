#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CodeDeployDeploymentsECSInfraStack } from '../lib/code_deploy_deployments_ecs_infra-stack';
import { CodeDeployDeploymentsEC2InfraStack } from '../lib/code_deploy_deployments_ec2_infra-stack';

const app = new cdk.App();

if (process.env.ECS) new CodeDeployDeploymentsECSInfraStack(app, 'CodeDeployDeploymentsECSInfraStack', {});
if (process.env.EC2) new CodeDeployDeploymentsEC2InfraStack(app, 'CodeDeployDeploymentsEC2InfraStack', {})