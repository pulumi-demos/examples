import { iam } from "@pulumi/aws";
import { nameBase } from "./config";

// Set up EKS Role
export const eksRole = new iam.Role(`${nameBase}-eksIamRole`, {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [{
      Action: "sts:AssumeRole",
      Principal: {
        Service: "eks.amazonaws.com"
      },
      Effect: "Allow",
      Sid: ""
    }]
  })
})

const eksServicePolicyAttachment = new iam.RolePolicyAttachment(`${nameBase}-eksServicePolicyAttachment`, {
  role: eksRole.id,
  policyArn: "arn:aws:iam::aws:policy/AmazonEKSServicePolicy"
})

const eksClusterPolicyAttachment = new iam.RolePolicyAttachment(`${nameBase}-eksClusterPolicyAttachment`, {
  role: eksRole.id,
  policyArn: "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
})

// Set up Nodegroup Role
export const ec2Role = new iam.Role(`${nameBase}-ec2NodeGroupIamRole`, {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [{
      Action: "sts:AssumeRole",
      Principal: {
        Service: "ec2.amazonaws.com"
      },
      Effect: "Allow",
      Sid: ""
    }]
  })
})

const eksWorkerNodePolicyAttachment = new iam.RolePolicyAttachment(`${nameBase}-eksWorkerNodePolicyAttachment`, {
  role: ec2Role.id,
  policyArn: "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
})

const eks_CNI_PolicyAttachment = new iam.RolePolicyAttachment(`${nameBase}-eks_CNI_PolicyAttachment`, {
  role: ec2Role.id,
  policyArn: "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
})

const ec2ContainerReadOnlyPolicyAttachment = new iam.RolePolicyAttachment(`${nameBase}-ec2ContainerReadOnlyPolicyAttachment`, {
  role: ec2Role.id,
  policyArn: "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
})