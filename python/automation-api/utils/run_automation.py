from utils.arrangement import get_arrangement_info
from utils.project import get_project_info
from utils.project import get_project_configoptions
from utils.runtime import prep_workspaces
from utils.stack import update_stacks 

# Description:
#   Processes the requested arrangement and calls project and stack utilities to update or destroy the given stacks.
# Inputs:
# - base_folder: The path to the arrangements folder
# - arrangements_file: The name of the arrangements file
# - arrangement_name: The name of the arrangement to run
# - org: The Pulumi org in which to run the given arrangement's project(s)
#   NOTE: Current implementation assumes same org for all stacks in the arrangement.
# - stack: The stack name to use for the update(s)
#   NOTE: Current implementation assumes same stack name (e.g. dev, prod, whatever) for all stacks in the arrangement.
# - destroy: If set to True then the arrangement's stack(s) are destroyed
# - config: A list of objects representing any config to set. Each object is of the form: {"name":CONFIG_OPTION_NAME, "value":VALUE_TO_SET}
#   NOTE: Currently the same config is set for all projects in the arrangement.
#   This is basically harmless since if the config doesn't apply for the given project in the arrangement, it'll be ignored.

def run_automation(base_folder: str, arrangements_file: str, arrangement_name: str, org: str, stack: str, destroy: bool, config: list):

    arrangement_info = get_arrangement_info(base_folder, arrangements_file, arrangement_name)

    arrangement_projects = []
    for project_folder in arrangement_info["project_folders"]:
        project_info = get_project_info(project_folder)
        project_info["org"] = org 
        project_info["stack"] = stack
        project_info["config"] = config 
        arrangement_projects.append(project_info)

    # At this point we have an array of projects and related information that is used to orchestrate and 
    # deploy the given arrangement.
    # So, deploy the arrangement's projects

    # Prep the runtime environments for each of the projects
    prep_workspaces(arrangement_projects)

    # update or destroy each of the stacks that make up the arrangement
    return(update_stacks(arrangement_projects, destroy))

