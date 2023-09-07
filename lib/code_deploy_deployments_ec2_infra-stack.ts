import { Stack, StackProps } from 'aws-cdk-lib';
import { AutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';
import { ServerDeploymentGroup, LoadBalancer as CodeDeployLoadBalancer, ServerDeploymentConfig, ServerApplication } from 'aws-cdk-lib/aws-codedeploy';
import { AmazonLinuxImage, InstanceClass, InstanceSize, InstanceType, LaunchTemplate, Peer, Port, SecurityGroup, SubnetType, UserData, Vpc } from 'aws-cdk-lib/aws-ec2';
import { LoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancing';
import { CompositePrincipal, ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class CodeDeployDeploymentsEC2InfraStack extends Stack {
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
    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(22), 'Allow SSH Access')

    const instanceProfileRole = new Role(this, "InstanceProfile", {
      assumedBy: new CompositePrincipal(new ServicePrincipal("ec2.amazonaws.com")),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonEC2RoleforAWSCodeDeployLimited"),
        ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
      ],
    });

    const deploymentRole = new Role(this, "DeploymentRole", {
      assumedBy: new ServicePrincipal("codedeploy.amazonaws.com"),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSCodeDeployRole"),
      ],
    });

    
    const userData = UserData.forLinux();

    userData.addCommands(`sudo yum update -y`)
    userData.addCommands(`sudo yum install -y ruby wget jq`)
    userData.addCommands(`cd /home/ec2-user`)
    userData.addCommands(`wget https://aws-codedeploy-us-east-1.s3.us-east-1.amazonaws.com/latest/install`)
    userData.addCommands(`sudo yum localinstall -y ./agent.rpm`)
    userData.addCommands(`chmod +x ./install`)
    userData.addCommands(`sudo ./install auto`)
    userData.addCommands(`sudo service codedeploy-agent start`)
    userData.addCommands(`sudo service codedeploy-agent status`)
    userData.addCommands('sudo yum install -y https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/linux_amd64/amazon-ssm-agent.rpm')

    const launchTemplate = new LaunchTemplate(this, "LaunchTemplate", {
      requireImdsv2: true,
      securityGroup: securityGroup,
      role: instanceProfileRole,
      userData,
      machineImage: new AmazonLinuxImage(),
      instanceType: InstanceType.of(
        InstanceClass.BURSTABLE2,
        InstanceSize.NANO,
      ),
    });

    const loadbalancer = new LoadBalancer(this, `LoadBalancer`, {
      vpc,
      internetFacing: true,
      healthCheck: {
        port: 80
      },
    });
    const listener = loadbalancer.addListener({ externalPort: 80 })
    listener.connections.allowDefaultPortFromAnyIpv4('Open to the world');

    const asg = new AutoScalingGroup(this, `AutoScalingGroup`, {
      vpc,
      minCapacity: 2,
      desiredCapacity: 2,
      maxCapacity: 2,
      mixedInstancesPolicy: {
        launchTemplate: launchTemplate,
        launchTemplateOverrides: [
          { instanceType: InstanceType.of(InstanceClass.BURSTABLE2, InstanceSize.NANO) },
        ]
      },
    });

    loadbalancer.addTarget(asg);

    const application = new ServerApplication(this, "ServerApplication", {
      applicationName: "EC2InfraServerApplication"
    })

    new ServerDeploymentGroup(this, "ServerDeploymentGroup", {
      application,
      deploymentGroupName: "EC2InfraServerDeploymentGroup",
      loadBalancer: CodeDeployLoadBalancer.classic(loadbalancer),
      deploymentConfig: ServerDeploymentConfig.ONE_AT_A_TIME,
      role: deploymentRole,
      autoScalingGroups: [asg],
    })
  }
}
