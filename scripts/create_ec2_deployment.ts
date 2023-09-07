import { CodeDeploy, RevisionLocationType } from "@aws-sdk/client-codedeploy";

const codeDeployClient = new CodeDeploy({});

codeDeployClient.createDeployment({
  applicationName: "EC2InfraServerApplication",
  deploymentGroupName: "EC2InfraServerDeploymentGroup",
  revision: {
    revisionType: RevisionLocationType.GitHub,
    gitHubLocation: {
      commitId: "8e1bb29d04107ababe6db9eefb64a68f94500183",
      repository: "TokioXx/codedeploy-sample"
    } 
  },
}).then((resp) => {
  console.log(`The deployment[${resp.deploymentId}] has been successfully created.`)
}).catch(err => {
  console.log(err)
})