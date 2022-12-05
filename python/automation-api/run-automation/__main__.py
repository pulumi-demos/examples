# from pulumi_orch.automate.stack_utils import update_stack

# org = "MitchGerdisch"
# project = "test-project"
# stack = "dev"
# stack_outputs = update_stack(org, project, stack, False)
# print(f"main stack outputs: {stack_outputs}")

import yaml

print("running code")
with open('../deployments.yaml') as f:
    my_dict = yaml.safe_load(f)

print(my_dict)

