import argparse
import yaml
from orchestration.stack_utils import update_stacks 
from orchestration.project_utils import get_project_info
from orchestration.runtime_utils import prep_workspaces

# Command line arguments
parser = argparse.ArgumentParser(description="Pulumi automation API example.",
                                 formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument("-a", "--arrangement", required=True, help="name of arrangement to deploy (see arrangements.yaml)")
parser.add_argument("-o", "--org", required=True, help="name of organization name use")
parser.add_argument("-s", "--stack",  required=True, help="stack name (e.g. dev, prod)")
parser.add_argument("-d", "--destroy", action="store_true", help="destroy the arrangement")
args = parser.parse_args()

arrangement_name = args.arrangement
org = args.org
stack = args.stack
destroy = args.destroy

# Parse the arrangements yaml and get the info for the specified arrangement 
with open('./arrangements.yaml') as f:
    arrangements_config = yaml.safe_load(f)
base_folder = arrangements_config["base-folder"]
arrangements = arrangements_config["arrangements"]

arrangement_projects = []
for arrangement in arrangements:
    # If we find the arrangement in the arrangements yaml, then gather up the related projects information
    # needed to orchestrated the deployment.
    if arrangement_name == arrangement["name"]:
        # Gather up the information for all the projects that make up the specified arrangement
        for project_folder in arrangement["projects-folders"]:
            project_info = get_project_info(f'{base_folder}/{project_folder}')
            # current implementation assumes same org and stack name (e.g. dev, prod, whatever) for all stacks in
            # an arrangement. 
            project_info["org"] = org 
            project_info["stack"] = stack
            arrangement_projects.append(project_info)

# At this point we have an array of projects and related information that is used to orchestrate and 
# deploy the given arrangement.
# So, deploy the arrangement's projects

# Prep the runtime environments for each of the projects
prep_workspaces(arrangement_projects)

# update or destroy each of the stacks that make up the arrangement
update_stacks(arrangement_projects, destroy)



    

    





