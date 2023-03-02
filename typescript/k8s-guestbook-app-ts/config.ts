import { Config, getOrganization, getProject, getStack, StackReference } from "@pulumi/pulumi";

const org = getOrganization()
const currentStack = getStack()
const project = getProject()

const config = new Config()
const k8sStackProject = config.require("k8sProject")

const k8sStackName = `${org}/${k8sStackProject}/${currentStack}`
const k8sStackRef = new StackReference(k8sStackName)

export const kubeconfig = k8sStackRef.requireOutput("kubeconfig") 

export const zoneName = config.require("zoneName")
export const stackTagName = config.get("stackTagName") ?? "Application"
export const stackTagValue = config.get("stackTagValue") ?? "Guestbook"