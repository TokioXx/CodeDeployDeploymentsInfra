import { Stack, StackProps } from 'aws-cdk-lib';
import { EcsApplication, EcsDeploymentConfig, EcsDeploymentGroup } from 'aws-cdk-lib/aws-codedeploy';
import { SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, ContainerImage, DeploymentControllerType } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { ApplicationProtocol, ApplicationTargetGroup, TargetType } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

export class CodeDeployDeploymentsECSInfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, 'VPC', {
      natGateways: 0,
      subnetConfiguration: [{
        name: "asterisk",
        subnetType: SubnetType.PUBLIC,
      }],
    });

    const securityGroup = new SecurityGroup(this, 'SecurityGroup', {
      vpc,
      description: 'Allow HTTPS out',
      allowAllOutbound: true
    });

    const application = new EcsApplication(this, 'CodeDeployApplication', {
      applicationName: 'CodeDeployApplication', // optional property
    });

    const cluster = new Cluster(this, 'Cluster', { vpc });
    const blueService = new ApplicationLoadBalancedFargateService(this, 'CodeDeployEcsService', {
      cluster,
      memoryLimitMiB: 1024,
      desiredCount: 1,
      cpu: 512,
      taskImageOptions: {
        image: ContainerImage.fromRegistry("public.ecr.aws/ecs-sample-image/amazon-ecs-sample:latest"),
      },
      loadBalancerName: 'application-lb-blue',
      deploymentController: {
        type: DeploymentControllerType.CODE_DEPLOY
      },
      assignPublicIp: true,
    });

    const greenTargetGroup = new ApplicationTargetGroup(this, 'CodeDeployGreenTargetGroup', {
      vpc,
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      targetType: TargetType.IP,
    });

    new EcsDeploymentGroup(this, 'BlueGreenDG', {
      service: blueService.service,
      blueGreenDeploymentConfig: {
        blueTargetGroup: blueService.targetGroup,
        greenTargetGroup: greenTargetGroup,
        listener: blueService.listener,
      },
      deploymentConfig: EcsDeploymentConfig.ALL_AT_ONCE,
    });

  }
}
