from utils.arrangement import get_arrangement_info
from utils.project import get_project_info
from utils.runtime import prep_workspaces
from utils.stack import update_stacks 

def run_automation(base_folder: str, arrangements_file: str, arrangement_name: str, org: str, stack: str, destroy: bool):

    arrangement_info = get_arrangement_info(base_folder, arrangements_file, arrangement_name)

    arrangement_projects = []
    for project_folder in arrangement_info["project_folders"]:
        project_info = get_project_info(project_folder)
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
    return(update_stacks(arrangement_projects, destroy))

